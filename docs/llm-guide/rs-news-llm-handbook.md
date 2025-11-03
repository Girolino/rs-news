# RS News App — LLM Implementation Handbook

Single source of truth for large-language-model agents contributing to the RS News project. This handbook consolidates the previous deployment, planning, output-contract, and testing guides and adds a detailed UI and pipeline analysis derived via ULTRATHINK review of the codebase (state as of 03 November 2025).

---

## 1. Product & Domain Snapshot
- **Goal:** deliver concise, citation-backed summaries of Brazilian macroeconomic and corporate news (Portuguese) to a Telegram channel.
- **Cadence:** scheduled hourly (06:00–19:00, Monday–Friday, America/Sao_Paulo) via Trigger.dev task `news-orchestrator`.
- **Tone & language:** outputs are in Brazilian Portuguese; ticker tags are uppercase without `#`.
- **Primary sources:** OpenAI web search constrained to a curated allowlist (Valor, Infomoney, Estadão, CVM, BCB, Reuters, etc.). Stick to verifiable sources—no paywalled or speculative content.
- **Hard constraints:** no dedicated news API, RSS feed, Postgres, or Sentry. Prioritise retrieve-then-generate workflows with deterministic citations.

---

## 2. UI Inventory (Applied ULTRATHINK)
The current Next.js 16 App Router UI is intentionally minimal and unauthenticated.
- **Home (`src/app/page.tsx`):** static marketing-style page centring the app name, description, and key endpoints. Tailwind CSS v4 utilities are used inline via class names; there are no client components or stateful hooks.
- **Layout (`src/app/layout.tsx`):** wraps children with Geist Sans/Mono fonts and `antialiased` body class. Language is set to `en` to support Telegram operator usage.
- **Styling (`src/app/globals.css`):** imports Tailwind v4 (`@import "tailwindcss"`), defines light/dark CSS variables, applies a sans fallback (`Arial`). No custom Tailwind config file beyond default PostCSS plugin.
- **Admin dashboard (`/admin/dashboard`):** server component que lê métricas da execução (`agent:news:last_run`, `agent:news:runs`). Protegido por token via query string (`?token=<ADMIN_DASHBOARD_TOKEN>`); não possui estado cliente nem mutações.
- **Implications for contributors:** Frontend changes currently require building new route groups and components from scratch. Maintain Tailwind utility patterns, respect the existing minimal aesthetic, and ensure any admin UI remains behind authentication if implemented.

---

## 3. System Architecture Overview

### Current Architecture (Trigger.dev v4)

```
Trigger.dev Scheduled Task (newsOrchestratorTask)
   Schedule: Mon-Fri 6h-19h (America/Sao_Paulo)
   Lock: Redis cron:news:lock (single-flight, 10 min TTL)
   Machine: medium-1x (1 vCPU, 2 GB RAM)
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│ Orchestrator Task: trigger/orchestrator.task.ts         │
│   1. Discovery   →  runDiscoveryStage (LLM + web search) │
│   2. Prefilter   →  runPrefilterStage (heuristics)       │
│   3. Rerank      →  runRerankStage (LLM scoring)         │
│   4. Dedup       →  runDedupStage (Upstash Search)       │
│   5. Batch Trigger → newsSenderTask (with delays)        │
└──────────────────────────────────────────────────────────┘
          │
          ▼ (batch trigger with incremental delays)
┌──────────────────────────────────────────────────────────┐
│ News Sender Task: trigger/sender.task.ts                │
│ Queue: concurrencyLimit=1 (one at a time)               │
│ Machine: small-1x (0.5 vCPU, 0.5 GB RAM)                │
│   1. Wait        →  wait.for (2-5 min random delay, cap 30m) │
│   2. Summarize   →  runSummarizeStage (LLM structured)   │
│   3. Format      →  runFormatStage (Telegram HTML)       │
│   4. Send        →  sendTelegramMessage (with retry)     │
│   5. Persist     →  runPersistStage (Redis + Search)     │
└──────────────────────────────────────────────────────────┘
          │
          ▼
Telegram channel + Upstash persistence
```

Multi-canal: `CHANNELS` em `src/config/channels.ts` descreve cada rota de distribuição (chatId, tópicos extras, thresholds, filtros e feature flags). O orchestrator itera por esses canais, aplicando overrides por canal e registrando métricas individuais em `orchestrator.complete.channels`.

Monitoramento e alertas:
- **Trigger.dev – `newsDailyReportTask`** (`trigger/monitoring.task.ts`): roda em dias úteis às 20h BRT, agrega as últimas execuções (`agent:news:runs`), sintetiza métricas por canal e envia um relatório HTML para `TELEGRAM_ADMIN_CHAT_ID`.
- **Alertas ad-hoc**: o orchestrator acompanha streak de runs sem envio (`agent:news:zero_send_streak`) e falhas por canal; ao atingir 3 execuções sem envio ou detectar erros, notifica automaticamente o chat admin via Telegram.
- **Admin Dashboard** (`src/app/admin/dashboard/page.tsx`): página server-side com token único (`?token=`) que lê `agent:news:last_run` + histórico recente e exibe tabela de canais, métricas de duração e status de runs. Serve como console rápido para operadores sem depender do Trigger.dev.

Key runtime characteristics:
- **Orchestrator**: ~2-3 minutes execution (discovery dominates), runs hourly during business hours
- **Sender**: ~30-60 seconds per news item (excluding 2-5 min waits, capped at 30m), processes one news at a time
- **Delays**: 2-5 minute random waits between news (capped at 30 minutes cumulative) simulate human curation (waits > 5s don't count for compute)
- **Concurrency**: Queue with `concurrencyLimit=1` ensures sequential delivery
- **Retry**: Automatic retry (3 attempts) for transient Telegram failures
- **Structured logs**: JSON logs via `src/server/lib/logger.ts`; last run metadata stored at `agent:news:last_run`
- **Locking**: Redis distributed lock (`cron:news:lock`) prevents overlapping orchestrator runs
- **Observability**: Full run history, logs, and metrics available in Trigger.dev dashboard

### Why Trigger.dev?

Two main problems solved:

1. **Timezone reliability**: Vercel cron had issues respecting `America/Sao_Paulo` timezone. Trigger.dev has native IANA timezone support.

2. **UX improvement**: Previously, all news were sent simultaneously to Telegram (robot-like "vomiting"). Now they're sent sequentially with random 2-5 minute delays, simulating human curation.

### Legacy Architecture (Deprecated)

<details>
<summary>Click to see legacy Vercel Cron architecture (deprecated Nov 2025)</summary>

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

**Note**: The legacy API route `/api/cron/news-agent` still exists but is no longer called by Vercel cron. The Vercel cron configuration is disabled in `vercel.json`. The route can still be manually triggered if needed.

</details>

---

## 4. Pipeline Stage Reference

### 4.1 Discovery (`src/server/agent/stages/discovery.ts`)
- Usa OpenAI Responses API (`gpt-5-mini`) com `web_search` geolocalizado para São Paulo.
- Conjunto base de tópicos fixos (`BASE_SEARCH_TOPICS`) e slot dinâmico via `DISCOVERY_DYNAMIC_TOPIC` (lista separada por vírgulas/linhas).
- Domínios filtrados por `DOMAIN_WHITELIST`; instruções do prompt reforçam allowlist e frescor (12-24h).
- `generateText` coleta o texto bruto; `generateObject` normaliza em `{ id, url, title, summary, publishedAt, source }`.
- Itens com domínio fora da whitelist ou erro de schema são descartados com log.

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
- Consulta Upstash Search pelo título (`reranking: true`) e aplica dois critérios:
  - Similaridade semântica do índice: `score >= DEDUP_SIMILARITY_THRESHOLD` (padrão 0.9).
  - Fingerprint lexical (SimHash 64 bits) calculado sobre `normalizedTitle + body` e comparado com `metadata.bodyFingerprint`; duplica quando distância de Hamming ≤ `DEDUP_SIMHASH_DISTANCE_THRESHOLD` (padrão 12).
- Se a busca falhar, o item segue (fail-open) mas o erro é logado; matches por fingerprint registram `stage.dedup.simhash_match`.

### 4.5 Summarisation (`summarize.ts`)
- Generates structured output using `buildSummarizePrompt` (Portuguese instructions, zero-indexed citations reminder).
- Validates citations via `validateCitations` ensuring every bullet has at least one citation and indices are valid.
- Normalises tags: trims, removes `#`, forces uppercase, ensures ticker regex match.
- Failures are counted; pipeline continues without the failed item.
- Quando `ENABLE_ANALYSIS_COMMENTARY=true`, resultado estruturado é repassado ao estágio `commentary.ts` para geração de insight automatizado (máx. 260 caracteres, 2 frases).

### 4.6 Format (`format.ts`)
- Delegates to `buildTelegramMessage` to produce HTML message capped at Telegram’s 4096-char limit.
- Deduplicates citations by URL before rendering.

### 4.7 Send (`send.ts`)
- Calls Telegram `sendMessage` with HTML parse mode and link preview disabled.
- Retries up to 2 times with exponential backoff via `p-retry`.
- Records successes/failures as `StoredNewsRecord`; failures retain content for retry endpoint.
- Se existir comentário gerado e flag ativa, aguarda `ANALYSIS_COMMENTARY_DELAY_SECONDS` (default 7s) e envia segunda mensagem: `🤖💬 <b>Comentário</b>` + texto + `<i>(análise automatizada)</i>`. Falhas no comentário não bloqueiam o fluxo factual.
- Quando `ENABLE_CHARTIMG=true` e o impacto ≥ média, tenta enviar `sendPhoto` com gráfico Chart-IMG para o primeiro ticker (`BMFBOVESPA:<ticker>`). Respeita cache Redis (10 min) e limite horário (`CHARTIMG_MAX_CALLS_PER_HOUR`).

### 4.8 Persist (`persist.ts`)
- Persists records under `sent_news:{newsId}` in Redis.
- Successful sends additionally upsert into Upstash Search for future deduplication/search.

---

## 5. Supporting Services & Utilities
- **Environment loader:** `src/config/env.ts` merges UPSTASH legacy keys, validates using Zod, caches results. Numeric helpers provided via `getNumericEnv`.
- **Channel config:** `src/config/channels.ts` lista canais ativos (chatId, tópicos extras, thresholds, filtros e flags).
- **Locks:** `src/server/lib/lock.ts` uses Redis `SET NX` with UUID token to guard cron concurrency.
- **Logging:** `src/server/lib/logger.ts` outputs JSON to stdout (`level`, `message`, `timestamp`, meta).
- **Hashing:** `src/server/lib/hash.ts` provides URL canonicalisation and deterministic ID generation.
- **Telegram client:** `src/server/services/telegram/client.ts` wraps fetch with schema validation, `p-retry`, and defaults to environment chat ID getter.
- **Chart-IMG wrapper:** `src/server/services/market/chartImg.ts` consulta API v1 (`advanced-chart/storage`), aplica cache Redis (10 min) e control de quota (`CHARTIMG_MAX_CALLS_PER_HOUR`).
- **Monitoring store:** `trigger/orchestrator.task.ts` grava métricas compactadas em `agent:news:runs` (lista circular) e `agent:news:last_run`; `newsDailyReportTask` consome esses dados para relatórios.
- **Admin dashboard server component:** `src/app/admin/dashboard/page.tsx` carrega métricas direto do Redis e renderiza tabelas responsivas; exige query param `token=<ADMIN_DASHBOARD_TOKEN>` para acesso.
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
| **Trigger.dev** | Task orchestration & scheduling | `trigger/*.ts`, `trigger.config.ts` | Scheduled tasks with IANA timezone support, queues, retries. |
| **Vercel Cron** _(deprecated)_ | Scheduling | `vercel.json` _(disabled)_ | Replaced by Trigger.dev scheduled tasks. |

### Environment Variables
```bash
# OpenAI
OPENAI_API_KEY=sk-…                # Required

# Upstash
UPSTASH_REDIS_REST_URL=…           # Required
UPSTASH_REDIS_REST_TOKEN=…         # Required
UPSTASH_SEARCH_REST_URL=…          # Required
UPSTASH_SEARCH_REST_TOKEN=…        # Required
UPSTASH_SEARCH_INDEX=news-br       # Optional override

# Telegram
TELEGRAM_BOT_TOKEN=…               # Required
TELEGRAM_CHAT_ID=@channel-or-id    # Required

# Trigger.dev
TRIGGER_PROJECT_REF=…              # Required for Trigger.dev
TRIGGER_API_KEY=…                  # Required for Trigger.dev
TRIGGER_API_URL=…                  # Optional (defaults to https://api.trigger.dev)

# Configuration
CRON_SECRET=…                      # Optional bearer token for legacy cron/admin routes
MAX_NEWS_PER_RUN=10                # Optional override
RELEVANCE_THRESHOLD=7              # Optional override
DEDUP_SIMILARITY_THRESHOLD=0.9     # Optional override
DEDUP_SIMHASH_DISTANCE_THRESHOLD=12 # Optional override (Hamming distance)
DISCOVERY_DYNAMIC_TOPIC=...        # Optional (comma/newline separated topics)
ENABLE_ANALYSIS_COMMENTARY=false   # Feature flag comentário automatizado
ANALYSIS_COMMENTARY_DELAY_SECONDS=7 # Delay entre notícia e comentário
ENABLE_CHARTIMG=false              # Feature flag para envio de gráficos
CHARTIMG_DEFAULT_RANGE=1M          # Range padrão (ex.: 1M, 3M, 6M)
CHARTIMG_DEFAULT_INTERVAL=1D       # Intervalo padrão (ex.: 1D, 4H)
CHARTIMG_DEFAULT_THEME=light       # light | dark
CHARTIMG_EXCHANGE=BMFBOVESPA       # Prefixo de exchange para símbolos TradingView
CHARTIMG_MAX_CALLS_PER_HOUR=10     # Limite de chamadas sem cache
CHARTIMG_SECRET_KEY=...            # Required ao habilitar gráficos Chart-IMG
NODE_ENV=production                # Set by platform
```

---

## 8. Operational Runbooks

### 8.1 Deploying to Trigger.dev
**Current deployment method (as of Nov 2025):**

1. **Setup Trigger.dev Project**
   - Create account at https://cloud.trigger.dev
   - Create new project
   - Note down `TRIGGER_PROJECT_REF` and `TRIGGER_API_KEY`

2. **Configure Environment Variables**
   - In Trigger.dev dashboard: Settings → Environment Variables
   - Add all required vars (OpenAI, Upstash, Telegram)
   - Configure for desired environments (Dev, Staging, Production)

3. **Deploy Tasks**
   ```bash
   # Login (first time only)
   npm run trigger:login

   # Deploy to staging
   npm run trigger:deploy --env staging

   # Deploy to production (after validation)
   npm run trigger:deploy --env production
   ```

4. **Post-deploy Validation**
   - Check Trigger.dev dashboard → Tasks
   - Verify `news-orchestrator` and `news-sender` appear
   - Check Schedules are enabled
   - Test manually: Dashboard → Tasks → Test
   - Monitor first scheduled run
   - Verify Telegram channel delivery

**See full deployment guide:** `docs/trigger-dev-deployment-guide.md`

### 8.2 Deploying to Vercel _(legacy - for Next.js app only)_
The Next.js app (frontend, API routes, tRPC) still deploys to Vercel:

1. Ensure environment variables are populated in Vercel project settings.
2. Confirm `OPENAI_API_KEY` tier supports web search for `gpt-5-mini`.
3. Deploy via CI or `vercel deploy`.
4. Post-deploy validation:
   - Test API routes if needed
   - Legacy cron route can be manually triggered: `curl -X POST https://<host>/api/cron/news-agent -H "Authorization: Bearer $CRON_SECRET"`

### 8.3 Manual Retries
- Endpoint: `POST /api/admin/retry-failed` (same Bearer auth as cron).
- Behaviour: scans Redis `sent_news:*`, filters `failedToSend === true`, replays messages, upserts successful retries into Upstash Search.
- Use after transient Telegram outages; safe to call multiple times.

### 8.4 Monitoring & Debugging

**Trigger.dev Dashboard:**
- **Runs**: View all task executions, filter by status, task, environment
- **Logs**: Structured JSON logs with full context
- **Metrics**: Duration, costs, success/failure rates
- **Schedules**: Next runs, enable/disable schedules

**Local Development:**
```bash
# Start Trigger.dev dev server
npm run trigger:dev

# In dashboard (usually http://localhost:3040), test tasks manually
```

**Troubleshooting:**
- Failed runs: Check logs in Trigger.dev dashboard
- Schedules not running: Verify enabled, correct environment, latest deployment
- Sender tasks stuck: Check queue status, concurrency limits
- High costs: Review machine sizes, task durations, optimize discovery

**Relatórios & alertas automatizados:**
- `newsDailyReportTask` (Trigger.dev) agrega as últimas 24h de runs e envia resumo para `TELEGRAM_ADMIN_CHAT_ID` — valide o chat ID e o token antes do deploy.
- O orchestrator incrementa `agent:news:zero_send_streak`; ao atingir 3 runs consecutivas sem envio, dispara alerta para o mesmo canal admin acompanhando o motivo (status por canal).
- Logs incluem `channelId`, `hasCommentary`, `chartImgStatus`; monitore-os via dashboard do Trigger.dev ou admin dashboard.

### 8.5 Legacy Lock & Concurrency Handling _(deprecated)_
- The legacy orchestrator used Redis distributed locks (`cron:news:lock`)
- Trigger.dev tasks have built-in concurrency control via queues
- If manually triggering legacy route: `runNewsAgent` throws `AgentAlreadyRunningError` if lock exists

### 8.6 Cost Envelope (Nov 2025 Estimates)

**OpenAI:**
- Per orchestrator run: \$0.10–\$0.17 (discovery dominates)
- Monthly (~68 runs: Mon-Fri 14h/day, Sat 5h/day): \$65–\$115

**Trigger.dev:**
- Orchestrator task: ~\$5–10/month (medium-1x, ~2-3 min/run)
- Sender tasks: ~\$5–15/month (small-1x, ~30-60s/news, waits don't count)
- Total Trigger.dev: ~\$10–25/month

**Upstash:**
- Redis & Search: stays within free tier under current volume

**Vercel:**
- Pro plan: ~\$20/month (for Next.js app hosting, not cron)

**Total Monthly Cost:** ~\$95–\$175/month (vs ~\$100–\$155 with Vercel cron)

**Note:** Waits > 5 seconds don't count for Trigger.dev compute, so the 2-5 minute delays between news are free.

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
  - `node --import=tsx --import=dotenv/config scripts/smoke-commentary.ts`: valida geração de comentário automatizado (limite ≤ 260 caracteres).
  - `node --import=tsx --import=dotenv/config scripts/smoke-chartimg.ts`: valida integração Chart-IMG (cache Redis + quota horária).

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
- **Comentário automatizado:** mantenha prompts sem disclaimers/emoji extras; o formatter adiciona `🤖💬` e `(análise automatizada)` automaticamente, e falhas no comentário não devem bloquear o envio factual.

---

## 11. Known Gaps & Backlog (from ULTRATHINK analysis)
1. **Web search determinism:** integrate dedicated search APIs (Tavily/Serper/Bing) or build structured scrapers for regulatory sources to reduce reliance on LLM-driven search results.
2. **Dedup robustness:** complement vector similarity with lexical fingerprints (e.g., SimHash) to reduce false positives/negatives; parameterise by time window.
3. **Fact checking agent:** add a verification stage that cross-validates bullets against source context to minimise hallucinations.
4. **Locks & idempotency:** persist short-lived `idempotency:{fingerprint}` keys to stop duplicate Telegram sends during retries.
5. **Hardcoded prompts/models:** externalise model selection and prompt templates via configuration for rapid experimentation.
6. **Admin experience:** evoluir o dashboard tokenizado para uma experiência autenticada (login real, filtros por canal, ações de retry manual) e adicionar gráficos históricos.
7. **Alerting:** expandir alerta atual (zero send + falhas consecutivas) com painel de SLA, integração PagerDuty/e-mail e thresholds configuráveis por canal.
8. **Embedding index drift:** if embedding model changes, schedule reindex job; current plan assumes `text-embedding-3-small` (1536 dims) though not yet wired.

---

## 12. File & Module Map
```
src/
  config/
    env.ts                   # Zod loader + numeric helpers
    channels.ts              # Canalização multi-config (chatId, thresholds, filtros, flags)
  app/
    page.tsx                   # Static home page listing endpoints
    layout.tsx                 # Root layout & fonts
    api/
      cron/news-agent/route.ts # Legacy cron entrypoint (deprecated, still works for manual trigger)
      admin/retry-failed/...   # Retry failed Telegram sends
      trpc/[trpc]/route.ts     # tRPC adapter
  server/
    agent/                     # Legacy orchestrator + pipeline stages (stages still used by Trigger.dev)
    api/                       # tRPC router & root
    lib/                       # Lock, hash, logger, retry helpers
    services/
      ai/                      # Prompt builders + OpenAI gateway
      storage/                 # Redis & Upstash Search connectors
      telegram/                # Client + formatter
      market/                  # Integrações de mercado (Chart-IMG)
  types/                       # Shared Zod schemas

trigger/                       # Trigger.dev tasks (v4)
  index.ts                     # Task exports
  types.ts                     # Task payload schemas
  orchestrator.task.ts         # Scheduled orchestrator (discovery → dedup)
  sender.task.ts               # Queue-based sender (summarize → send)
  monitoring.task.ts           # Relatório diário (20h BRT) para canal admin

trigger.config.ts              # Trigger.dev configuration
scripts/                       # Smoke & debug scripts
docs/
  llm-guide/
    rs-news-llm-handbook.md    # ← this document
  trigger-dev-deployment-guide.md  # Trigger.dev deployment guide
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

# Start Next.js dev server
npm run dev

# Trigger.dev commands
npm run trigger:login          # Login to Trigger.dev (first time)
npm run trigger:dev            # Start Trigger.dev dev server
npm run trigger:deploy         # Deploy tasks to production
npm run trigger:deploy --env staging  # Deploy to staging
```

---

## 14. Change Log
- **03 Nov 2025 (Late Night):** Concluído plano Tier S estágios 4-6 — multicanal parametrizado (`config/channels.ts`), alertas/relatório diário (`newsDailyReportTask`), admin dashboard protegido por token e smoke tests dedicados (Chart-IMG, commentary). Integração com Chart-IMG habilitada via feature flag com cache/quota; documentação operacional expandida (monitoring runbook).
- **03 Nov 2025 (Evening):** Migrated from Vercel Cron to Trigger.dev v4. Split orchestrator into two tasks: scheduled orchestrator (discovery→dedup) and queue-based sender (summarize→send) with 2-5 min delays. Solves timezone issues and improves UX by delivering news sequentially. Added `trigger/` directory, `trigger.config.ts`, and deployment guide.
- **03 Nov 2025 (Morning):** Consolidated Portuguese guides into this English handbook; captured current UI state (no authenticated area) and reiterated pipeline/tuning backlog.
