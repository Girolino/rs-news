# RS News App — LLM Implementation Handbook

Single source of truth for large-language-model agents contributing to the RS News project. This handbook consolidates the previous deployment, planning, output-contract, and testing guides and adds a detailed UI and pipeline analysis derived via ULTRATHINK review of the codebase (state as of 03 November 2025).

---

## 1. Product & Domain Snapshot
- **Goal:** deliver concise, citation-backed summaries of Brazilian macroeconomic and corporate news (Portuguese) to a Telegram channel.
- **Cadence:** scheduled hourly (06:00–20:00, Monday–Friday, America/Sao_Paulo) via Vercel cron hitting `/api/cron/news-agent`.
- **Tone & language:** outputs are in Brazilian Portuguese; ticker tags are uppercase without `#`.
- **Primary sources:** OpenAI web search constrained to a curated allowlist (Valor, Infomoney, Estadão, CVM, BCB, Reuters, etc.). Stick to verifiable sources—no paywalled or speculative content.
- **Hard constraints:** no dedicated news API, RSS feed, Postgres, or Sentry. Prioritise retrieve-then-generate workflows with deterministic citations.

---

## 2. UI Inventory (Applied ULTRATHINK)
The current Next.js 16 App Router UI is intentionally minimal and unauthenticated.
- **Home (`src/app/page.tsx`):** static marketing-style page centring the app name, description, and key endpoints. Tailwind CSS v4 utilities are used inline via class names; there are no client components or stateful hooks.
- **Layout (`src/app/layout.tsx`):** wraps children with Geist Sans/Mono fonts and `antialiased` body class. Language is set to `en` to support Telegram operator usage.
- **Styling (`src/app/globals.css`):** imports Tailwind v4 (`@import "tailwindcss"`), defines light/dark CSS variables, applies a sans fallback (`Arial`). No custom Tailwind config file beyond default PostCSS plugin.
- **Logged area:** not implemented. There are no authenticated routes, dashboards, or TRPC-powered UIs; any “logged-area” work would be net new.
- **Implications for contributors:** Frontend changes currently require building new route groups and components from scratch. Maintain Tailwind utility patterns, respect the existing minimal aesthetic, and ensure any admin UI remains behind authentication if implemented.

---

## 3. System Architecture Overview
```
Vercel Cron (0 6-20 * * 1-5, BRT)
          │
          ▼
Next.js API route /api/cron/news-agent (Node runtime, 800s max)
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│ Orchestrator: src/server/agent/orchestrator.ts           │
│   1. Discovery   →  runDiscoveryStage (LLM + web search) │
│   2. Prefilter   →  runPrefilterStage (heuristics)       │
│   3. Rerank      →  runRerankStage (LLM scoring)         │
│   4. Dedup       →  runDedupStage (Upstash Search)       │
│   5. Summarize   →  runSummarizeStage (LLM structured)   │
│   6. Format      →  runFormatStage (Telegram HTML)       │
│   7. Send        →  runSendStage (Telegram API + retry)  │
│   8. Persist     →  runPersistStage (Redis + Search)     │
└──────────────────────────────────────────────────────────┘
          │
          ▼
Telegram channel + Upstash persistence
```

Key runtime characteristics:
- Execution time observed in smoke/E2E tests ~7 minutes with generous buffer versus Vercel’s 15-minute cap.
- Single-flight enforced by Redis distributed lock (`cron:news:lock`, 10-minute TTL).
- Structured logs (JSON) emitted by `src/server/lib/logger.ts`; last run metadata stored at `agent:news:last_run`.

---

## 4. Pipeline Stage Reference

### 4.1 Discovery (`src/server/agent/stages/discovery.ts`)
- Uses OpenAI Responses API (`gpt-5-mini`) with `web_search` tool and São Paulo geolocation.
- Topics hard-coded (`SEARCH_TOPICS`); domains filtered by `DOMAIN_WHITELIST`.
- Two-step flow: `generateText` collects prose, `generateObject` normalises to `{ id, url, title, summary, publishedAt, source }`.
- Outputs `DiscoveryNewsItem[]`; invalid items (missing whitelist domain, schema failures) are skipped with warnings.

### 4.2 Prefilter (`prefilter.ts`)
- Heuristics before expensive LLM calls:
  - Body length ≥ 100 chars.
  - Freshness ≤ 12 hours (`isOlderThanHours`).
  - Language heuristic ensures Portuguese.
  - Keyword presence check across title/body.
  - URL canonicalisation and duplicate detection.
- Augments with deterministic `newsId` (SHA-256 over URL/title) and `normalizedTitle`.
- Returns `{ items: PrefilteredNewsItem[]; discarded }`.

### 4.3 Rerank (`rerank.ts`)
- Builds editorial prompt summarising each candidate.
- Uses AI Gateway abstraction (`runGenerateObject`) with `gpt-5-mini`.
- Response schema: per-item `relevanceScore (0–10)`, `impact` (`alta|média|baixa`), `companies`, `categories`, `shouldProcess`.
- Filters by `RELEVANCE_THRESHOLD` (default 7) and `MAX_NEWS_PER_RUN` (default 10); both configurable via env.

### 4.4 Deduplication (`dedup.ts`)
- Queries Upstash Search index with title; `reranking: true`.
- Flags duplicates when score ≥ `DEDUP_SIMILARITY_THRESHOLD` (default 0.9).
- On search failures, item proceeds (fail-open) but error is logged.

### 4.5 Summarisation (`summarize.ts`)
- Generates structured output using `buildSummarizePrompt` (Portuguese instructions, zero-indexed citations reminder).
- Validates citations via `validateCitations` ensuring every bullet has at least one citation and indices are valid.
- Normalises tags: trims, removes `#`, forces uppercase, ensures ticker regex match.
- Failures are counted; pipeline continues without the failed item.

### 4.6 Format (`format.ts`)
- Delegates to `buildTelegramMessage` to produce HTML message capped at Telegram’s 4096-char limit.
- Deduplicates citations by URL before rendering.

### 4.7 Send (`send.ts`)
- Calls Telegram `sendMessage` with HTML parse mode and link preview disabled.
- Retries up to 2 times with exponential backoff via `p-retry`.
- Records successes/failures as `StoredNewsRecord`; failures retain content for retry endpoint.

### 4.8 Persist (`persist.ts`)
- Persists records under `sent_news:{newsId}` in Redis.
- Successful sends additionally upsert into Upstash Search for future deduplication/search.

---

## 5. Supporting Services & Utilities
- **Environment loader:** `src/config/env.ts` merges UPSTASH legacy keys, validates using Zod, caches results. Numeric helpers provided via `getNumericEnv`.
- **Locks:** `src/server/lib/lock.ts` uses Redis `SET NX` with UUID token to guard cron concurrency.
- **Logging:** `src/server/lib/logger.ts` outputs JSON to stdout (`level`, `message`, `timestamp`, meta).
- **Hashing:** `src/server/lib/hash.ts` provides URL canonicalisation and deterministic ID generation.
- **Telegram client:** `src/server/services/telegram/client.ts` wraps fetch with schema validation, `p-retry`, and defaults to environment chat ID getter.
- **Storage connectors:** `redis.ts` and `search.ts` lazily instantiate Upstash clients; both rely on env loader.
- **AI gateway helpers:** `src/server/services/ai/gateway.ts` centralises `generateText`/`generateObject` for consistent OpenAI usage.

---

## 6. Data Contracts

### 6.1 Structured News Item (`StructuredNewsItem`)
Derived from `src/types/news.ts`. Agents must honour this schema exactly.

| Field | Type / Constraints | Notes |
| --- | --- | --- |
| `id` | string | Original discovery identifier. |
| `newsId` | string | Deterministic SHA derived from URL/title. |
| `url` | string (URL) | Must remain in whitelist domains. |
| `title` | string | Original title; `finalTitle` holds edited title. |
| `publishedAt` | ISO datetime (offset required) | Always convert to Brasília Time offset. |
| `body` | string | Raw summary/lead from discovery stage. |
| `relevanceScore` | number 0–10 | Provided by rerank stage. |
| `impact` | `"alta" \| "média" \| "baixa"` | Economic materiality. |
| `companies` | string[] | Company names or tickers detected. |
| `categories` | string[] | High-level tags (e.g. `"macro"`, `"energia"`). |
| `finalTitle` | string ≤ 80 chars | Portuguese, professional tone. |
| `summary` | string ≤ 200 chars | Executive summary. |
| `bullets` | 2–3 strings ≤ 180 chars each | Each bullet must map to a citation. |
| `citations` | array of `{ url, title, quote, associatedBullet }` | `associatedBullet` zero-indexed. |
| `topic` | enum (`economia`, `politica`, `empresas`, `mercados`, `tecnologia`) | Choose the most specific fit. |
| `tags` | array of uppercase tickers (regex `^[A-Z0-9]{1,7}(?:\.[A-Z0-9]{1,3})?$`) | No `#`. Max three; duplicates removed. |
| `summaryForSearch` | short string | Used as vector text in Upstash Search. |
| `messageHtml` | string ≤ 4096 | Generated by formatter; escapes HTML. |
| `telegramMessageId` | number (optional) | Present after successful send. |
| `sentAt` | ISO datetime | Populated during send/persist. |
| `failedToSend` | boolean | Flags retry candidates. |

Validation is enforced via Zod and `validateCitations`. Any deviation will break the pipeline.

---

## 7. External Integrations

| Integration | Purpose | Key Files | Notes |
| --- | --- | --- | --- |
| **OpenAI (Responses API)** | Discovery, rerank, summarisation | `ai/gateway.ts`, `agent/stages/*` | Models defined in `src/lib/ai/models.ts` (currently all `gpt-5-mini`). |
| **Upstash Redis** | Locks, persistence (`sent_news:*` keys) | `services/storage/redis.ts` | Also stores last run metadata and retry state. |
| **Upstash Search** | Deduplication & search index | `services/storage/search.ts` | Index name defaults to `news-br`. |
| **Telegram Bot API** | Delivery channel | `services/telegram/client.ts` | HTML parse mode with previews disabled. |
| **Vercel Cron** | Scheduling | `vercel.json` | Cron window: hourly 06–20 Monday–Friday BRT. |

### Environment Variables
```bash
OPENAI_API_KEY=sk-…                # Required
UPSTASH_REDIS_REST_URL=…           # Required
UPSTASH_REDIS_REST_TOKEN=…         # Required
UPSTASH_SEARCH_REST_URL=…          # Required
UPSTASH_SEARCH_REST_TOKEN=…        # Required
UPSTASH_SEARCH_INDEX=news-br       # Optional override
TELEGRAM_BOT_TOKEN=…               # Required
TELEGRAM_CHAT_ID=@channel-or-id    # Required
CRON_SECRET=…                      # Optional bearer token for cron/admin
MAX_NEWS_PER_RUN=10                # Optional override
RELEVANCE_THRESHOLD=7              # Optional override
DEDUP_SIMILARITY_THRESHOLD=0.9     # Optional override
NODE_ENV=production                # Set by platform
```

---

## 8. Operational Runbooks

### 8.1 Deploying to Vercel
1. Ensure environment variables above are populated in Vercel project settings.
2. Confirm `OPENAI_API_KEY` tier supports web search for `gpt-5-mini`.
3. Deploy via CI or `vercel deploy`.
4. Post-deploy validation:
   - Trigger manual run: `curl -X POST https://<host>/api/cron/news-agent -H "Authorization: Bearer $CRON_SECRET"`.
   - Monitor Vercel logs for `agent.run.complete`.
   - Verify Telegram channel delivery.

### 8.2 Manual Retries
- Endpoint: `POST /api/admin/retry-failed` (same Bearer auth as cron).
- Behaviour: scans Redis `sent_news:*`, filters `failedToSend === true`, replays messages, upserts successful retries into Upstash Search.
- Use after transient Telegram outages; safe to call multiple times.

### 8.3 Lock & Concurrency Handling
- If `runNewsAgent` detects an existing lock, it throws `AgentAlreadyRunningError`; cron route returns HTTP 200 with `{ status: "skipped" }`.
- tRPC mutation `news.runAgent` mirrors this behaviour (skip unless `force` param is introduced in future).

### 8.4 Cost Envelope (Oct 2025 Measurements)
- OpenAI per execution: \$0.10–\$0.17 (discovery dominates).
- Monthly estimate (~88 weekday executions): \$80–\$135.
- Upstash (Redis & Search): stays within free tier under current volume.
- Vercel Pro plan required for cron (~\$20/month).

---

## 9. Testing & Quality Gates

### 9.1 Local Commands
- `npm run dev` — Next.js dev server (Turbopack).
- `npm run test` — Vitest suite (unit + integration).
- `npm run lint` — ESLint (Next.js config).
- `npx tsc --noEmit` — Type safety check (required after meaningful changes).

### 9.2 Test Coverage
- **Unit:** hashing, locking, formatter, validator, prefilter, dedup stages (`src/tests/unit/...`).
- **Integration:** orchestrator happy path with mocked stages (`src/tests/integration/orchestrator.test.ts`).
- **Smoke Scripts:**
  - `npm run smoke:ai` → `scripts/llm-smoke.ts`: validates OpenAI connectivity and web-search tool usage.
  - `npm run test:discovery` → `scripts/test-discovery.ts`: ad-hoc inspection of discovery output.
  - `npm run test:e2e` → `scripts/smoke-e2e.ts`: full pipeline dry run with mocked send/persist (no external side effects).

### 9.3 Testing Expectations for Contributors
1. Run `npx tsc --noEmit`.
2. Execute targeted `vitest` suites for touched areas; default to `npm run test`.
3. If pipeline logic changes, run `npm run test:e2e` with `.env.local` populated to catch integration regressions.
4. Capture and report key command outputs in PR / agent responses (success or failure).

---

## 10. Development Guidelines for LLM Agents
- **Apply ULTRATHINK for major trade-offs:** explicitly compare options (e.g., new data source vs. expanding whitelist) before modifying core stages.
- **Respect retrieve-then-generate discipline:** never fabricate citations; ensure discovery collects ground-truth URLs before summarisation.
- **Maintain allowlists:** Any new domain for discovery requires justification and should be added to the whitelist in `discovery.ts`.
- **Keep deterministic IDs intact:** `generateNewsId` output must remain stable; avoid altering canonicalisation/normalisation unless migrating stored data.
- **Concurrency safety:** If extending pipeline duration, revisit `LOCK_TTL_SECONDS` to avoid premature lock expiry.
- **Telemetry and logging:** preserve JSON log format; include high-signal keys when adding new logs.
- **Configuration hygiene:** default values belong in code (`DEFAULT_*` constants); actual overrides live in environment variables.
- **Deployment safety:** never remove Bearer auth checks from cron/admin endpoints; require `CRON_SECRET` in production environments.

---

## 11. Known Gaps & Backlog (from ULTRATHINK analysis)
1. **Web search determinism:** integrate dedicated search APIs (Tavily/Serper/Bing) or build structured scrapers for regulatory sources to reduce reliance on LLM-driven search results.
2. **Dedup robustness:** complement vector similarity with lexical fingerprints (e.g., SimHash) to reduce false positives/negatives; parameterise by time window.
3. **Fact checking agent:** add a verification stage that cross-validates bullets against source context to minimise hallucinations.
4. **Locks & idempotency:** persist short-lived `idempotency:{fingerprint}` keys to stop duplicate Telegram sends during retries.
5. **Hardcoded prompts/models:** externalise model selection and prompt templates via configuration for rapid experimentation.
6. **Admin experience:** build authenticated dashboard for recent sends, failures, and manual triggers (no UI exists today).
7. **Alerting:** add webhook or Telegram admin notifications when `sentCount === 0` for >3 consecutive runs or when send failures exceed threshold.
8. **Embedding index drift:** if embedding model changes, schedule reindex job; current plan assumes `text-embedding-3-small` (1536 dims) though not yet wired.

---

## 12. File & Module Map
```
src/
  app/
    page.tsx                   # Static home page listing endpoints
    layout.tsx                 # Root layout & fonts
    api/
      cron/news-agent/route.ts # Vercel cron entrypoint
      admin/retry-failed/...   # Retry failed Telegram sends
      trpc/[trpc]/route.ts     # tRPC adapter
  server/
    agent/                     # Orchestrator + pipeline stages
    api/                       # tRPC router & root
    lib/                       # Lock, hash, logger, retry helpers
    services/
      ai/                      # Prompt builders + OpenAI gateway
      storage/                 # Redis & Upstash Search connectors
      telegram/                # Client + formatter
  types/                       # Shared Zod schemas
scripts/                       # Smoke & debug scripts
docs/llm-guide/rs-news-llm-handbook.md  # ← this document
```

---

## 13. Quick Command Reference
```bash
# Install deps
npm install

# Type-check
npx tsc --noEmit

# Run tests
npm run test

# Smoke test pipeline (mocked send/persist)
npm run test:e2e

# Start dev server
npm run dev
```

---

## 14. Change Log
- **03 Nov 2025:** Consolidated Portuguese guides into this English handbook; captured current UI state (no authenticated area) and reiterated pipeline/tuning backlog.

