0) Scope, principles, and success criteria

Goal: A production‑grade analytics portal for Brazilian financial institutions, improving on BancoData in clarity, auditability, comparability, and UX, using only public data (IF.Data via OData/Olinda; Balancetes/COSIF; Relação de Instituições).

Non‑negotiables

Data lineage (every number traceable to a public source).

Reproducibility (raw downloads archived; transformations deterministic).

Consistency (clear separation of monthly COSIF vs. quarterly IF.Data).

Convex as the sole source of truth for structured data (time series, rankings, metadata).

Vercel Blob for large public artifacts (raw ZIP/CSV snapshots; user exports).

No scraping; zero private endpoints.

Definition of Done (global)

/relatorio/[slug] and /relatorio/[slug]/ifdata/[id] render reliable data for a representative sample of institutions and indicators (≥ 24 months COSIF; ≥ 16 quarters IF.Data).

Rankings by type of IF; deltas and statistics; drill‑down COSIF level‑3; export CSV.

Cron runs autonomous (Vercel Cron → Convex), with logs, heartbeats, and error capture inside Convex (no external service).

E2E tests pass in CI.

“About/Fontes” page shows license and sources.

1) System architecture (high level)

UI: Next.js 16 (App Router + RSC), shadcn/ui + Tailwind for widgets; Recharts (via shadcn/ui) for timeseries and charts.
API: tRPC Route Handler (fetchRequestHandler) for typed server contracts.
Data: Convex (collections, queries/mutations/actions, cron helpers).
Artifacts: Vercel Blob (public raw files and user exports).
Scheduling: Vercel Cron → Next Route Handler → Convex HTTP Action.
Observability: Vercel logs + Convex tables (errors, job_runs, dead_letters, metrics_daily) and JSON logging.
Testing: Vitest (unit/integration), Playwright (E2E automated only).

2) Repository layout
bancodata-plus/
  app/
    layout.tsx
    page.tsx
    relatorio/
      [slug]/
        page.tsx
        ifdata/[id]/page.tsx
    api/
      trpc/[trpc]/route.ts          // tRPC handler
      cron/
        ifdata/route.ts             // Vercel Cron -> Convex action
        cosif/route.ts              // Vercel Cron -> Convex action
        compute/route.ts            // Vercel Cron -> Convex action
      revalidate/route.ts           // POST revalidateTag helper
      health/route.ts               // GET health snapshot (protected by header)
  components/
    charts/TimeSeries.tsx
    ui/ (shadcn components copied-in)
    KpiCard.tsx
    RankingTable.tsx
    CosifTree.tsx
    SourceFootnote.tsx
    ComparePicker.tsx
    EmptyState.tsx
  server/
    trpc/
      context.ts
      router/
        index.ts
        institutions.ts
        indicators.ts
        series.ts
        rankings.ts
        compare.ts
        search.ts
    clients/
      odata.ts       // OData client (retry/backoff, pagination)
      cosif.ts       // download & parse ZIP/CSV
      blob.ts        // tiny wrapper for Blob put/list/head
    math/
      stats.ts
      ranking.ts
      resampling.ts
    logging/
      logger.ts
      handleError.ts
  convex/
    schema.ts
    ingest_ifdata.ts
    ingest_cosif.ts
    institutions.ts
    compute.ts
    http.ts            // HTTP Actions (convex.site) — optional if you prefer Next route proxy
    cron.ts            // optional housekeeping
  scripts/
    bootstrap_indicators.ts // seed IF.Data reports & COSIF dictionary (level 3)
    backfill_slugs.ts
  public/
  styles/
  tests/
    unit/
    integration/
    e2e/ (Playwright)
  next.config.js
  vercel.json
  package.json
  .env.local           // already contains Convex & Blob vars
  README.md

3) Environment & configuration (assumptions for LLM)

.env.local already contains all keys used below. LLMs must read from process.env and never ask humans.

Expected keys (names are examples; adjust only if the repo template differs):

Convex: CONVEX_DEPLOYMENT, CONVEX_DEPLOY_KEY (if needed for HTTP API), CONVEX_SITE_URL or CONVEX_URL.

Blob: BLOB_READ_WRITE_TOKEN, BLOB_BASE_URL.

Data sources:

IFDATA_BASE (OData base URL for IF.Data).

INSTITUTIONS_BASE (OData base URL for Relação de Instituições).

COSIF_BASE (root or pattern for Balancetes/COSIF ZIPs).

LLMs: never echo secrets; never log them. Only interpolate in requests.

4) Data modeling (Convex)

Tables & indexes (convex/schema.ts)

institutions — { cnpj, name, tradeName?, type?, congCode?, slug, openedAt?, createdAt, updatedAt }
Indexes: by_slug, by_cnpj, by_type.

indicators — { source: 'IFDATA'|'COSIF', sourceId?, code, name, unit?, freq:'M'|'Q', group?, cadoc?, cosifLevel?, meta?, createdAt, updatedAt }
Indexes: by_code, by_source, by_group.

series — { institutionId, indicatorId, refDate:ISO, periodKey:'YYYY-MM'|'YYYY-Qn', consolidation:'INSTITUICAO'|'CONGLOMERADO', value:number, sourceDoc?, isEstimated?, createdAt }
Indexes: by_inst_ind_period, by_indicator_period, by_inst_period.

rankings — { indicatorId, periodKey, instType, institutionId, value, rank, pct?, createdAt }
Indexes: by_ind_period_type_rank, by_ind_period_type_inst.

lineage — { source:'IFDATA'|'COSIF', sourceUrl, blobKey?, blobUrl?, sha256, bytes, periodKey, note?, fetchedAt, parseVersion }
Indexes: by_source_period.

Telemetry:

errors — { ts, source:'cron'|'api'|'ui'|'action', code?, message, stack?, ctx? }

job_runs — { job:'ifdata'|'cosif'|'compute', runId, startedAt, finishedAt?, status:'ok'|'err', errorId? }

dead_letters — { kind, payloadRef, firstSeen, lastTried, tries, lastError? }

metrics_daily — { day:'YYYY-MM-DD', ingestRows, ingestBytes, computeMs, failures }

(Optional) search_aliases — { institutionId, alias } for full‑text autocomplete.

Period keys

Monthly (COSIF): YYYY-MM.

Quarterly (IF.Data): YYYY-Q1|Q2|Q3|Q4.

5) Ingestion pipelines
5.1 IF.Data (quarterly, OData)

Discovery: query ListaDeRelatorio → seed indicators with { source:'IFDATA', sourceId:IdRelatorio, unit, freq:'Q', group:'IFData' }.

Values collection: for each selected report & institution type, fetch IfDataValores across the target window (e.g., last 16–24 quarters). Handle OData pagination (@odata.nextLink) and retry/backoff.

Persist: upsert into series and add a lineage record per batch with SHA‑256 and optional Blob archival for JSON payloads.

Consolidation: keep the consolidation level provided by the report (document in sourceDoc).

Convex actions/mutations (convex/ingest_ifdata.ts):

refresh({ windowQuarters }) — orchestrates discovery (optional), fetch, persist.

upsertSeriesBatch(records) — single mutation for batch upsert (idempotent key = institutionId|indicatorId|periodKey|consolidation).

recordLineage(...) — save lineage + (optionally) upload raw to Blob.

5.2 COSIF (monthly/trimestral, CSV/ZIP)

Download: construct URLs for aggregated or individualized ZIPs; HEAD check; download; unzip; parse CSV (likely ; delimiter, latin1).

Normalize: validate columns (YYYYMM, CNPJ, CADOC (4010/4040), Account, AccountName, Balance).

Dictionary: maintain a COSIF level‑3 dictionary → indicator mapping in indicators.meta (seeded by scripts/bootstrap_indicators.ts).

Aggregate: sum balances per {CNPJ, indicatorCode, period}; persist to series (freq:'M', consolidation from CADOC).

Lineage: record hash, size, and Blob pointer for each raw ZIP (and optional normalized CSV).

Convex code (convex/ingest_cosif.ts):

refresh({ yyyymmFrom, yyyymmTo, doc:'4010'|'4040', tipo }) — windowed fetch.

parseZipToRecords(zipBuffer) — server/clients/cosif.ts.

mapAccountsToIndicators(records, dictionary) — group by indicatorCode.

upsertSeriesBatch(...) and recordLineage(...) as above.

6) Institution metadata

Fetch from Relação de Instituições OData; upsert into institutions (cnpj, name, tradeName, type, congCode, openedAt).

Generate unique slug from tradeName || name.

Convex code (convex/institutions.ts):

sync() (idempotent) + ensureSlugUniqueness.

7) Computations (derivatives & rankings)

Math library (server/math)

delta(a,b) -> {abs, pct|null}

median(xs), stdev(xs)

rollupYear(monthlySeries), rollupSemester(monthlySeries)

rankWithinType(values[]) with average‑rank ties and percentiles

Convex action (convex/compute.ts)

rebuild({ periods }) — materialize rankings for each indicatorId x periodKey x instType.

After compute, POST to /api/revalidate with tags for affected institutions and indicators.

8) APIs (tRPC)

Route: app/api/trpc/[trpc]/route.ts with fetchRequestHandler.

Routers

institutions: bySlug(slug), list({ q?, type?, limit? }).

indicators: getByCode(code), listByGroup(group).

series: forInstitution({ slug, indicatorCode, from?, to? }), latestSnapshot({ slug }).

rankings: position({ slug, indicatorCode, periodKey }), table({ indicatorCode, periodKey, instType, top? }).

compare: matrix({ slugs[], indicatorCodes[], period }).

search: autocomplete(q) (Convex full‑text optionally).

Validation: zod on all procedures.
Pagination: deterministic cursors for tables.

9) UI/UX (Next 16 + shadcn/ui)

/relatorio/[slug]

Header: name, CNPJ (masked), type, openedAt.

Sections: Patrimônio (COSIF M), Resultado (COSIF M), Capital/Risco (IF.Data Q).

Cards: current value, Δ QoQ/YoY or MoM/YoY, last period date.

Charts: TimeSeries with period selector (24/60 months; 16/20 quarters).

CosifTree: drill‑down level‑3.

Ranking: position & percentile among same IF type.

SourceFootnote per block (IF.Data, COSIF, Institutions).

Export: CSV for the currently visible series/table (generated server‑side, streamed to Blob, return public URL).

/relatorio/[slug]/ifdata/[id]

Resolve id to Indicator.sourceId (IF.Data).

Q‑series, metadata (unit, consolidation), ranking, statistics.

Compare

Multi‑IF, multi‑indicator with normalized units; mini‑sparklines and correlation hint.

shadcn/ui components to scaffold now:
Button, Input, Select, Tabs, Dialog, Sheet, DropdownMenu, Tooltip, Skeleton, Table (with TanStack), Command (for global search), Toast, Chart (Recharts wrapper for LineChart, BarChart, AreaChart).

10) Caching & revalidation (Next 16)

All server data fetchers attach tags:

institution:{slug} and indicator:{code}.

app/api/revalidate/route.ts exposes POST to call revalidateTag([...tags]).

Convex actions call this endpoint on successful ingest/compute for the touched keys.

11) Artifacts with Vercel Blob

Use Blob for

Raw: IF.Data payload dumps (optional), COSIF ZIPs.

Normalized: NDJSON/CSV per month/segment (optional).

Exports: CSVs users download from charts/tables.

Key structure

raw/cosif/{YYYY}/{YYYY-MM}/{cadoc}/{tipo}/{file}.zip
raw/ifdata/{YYYY-Qn}/{reportId}.json
norm/cosif/{YYYY}/{YYYY-MM}/{indicator}.csv
exports/{slug}/{indicator}/{periodKey}.csv


Convex lineage stores: { source, sourceUrl, blobKey, blobUrl, sha256, bytes, periodKey, fetchedAt }.

LLM rule: never store time‑series in Blob; Convex remains the source of truth.

12) Observability without external services

Logger (server/logging/logger.ts): JSON one‑line per event {ts, level, scope, msg, ctx?, err?}.

Error capture: central handleError(e, ctx) logs + inserts into errors via Convex mutation.

Job runs: insert on start, update on finish; status ok|err; link errorId if failed.

Health: GET /api/health (protected by header) returning last run timestamps per job.

(Optional) Web Vitals endpoint that upserts into metrics_daily.

13) Scheduling (Vercel Cron → Convex)

vercel.json

{
  "crons": [
    { "path": "/api/cron/ifdata",  "schedule": "0 4 * * *" },
    { "path": "/api/cron/cosif",   "schedule": "0 3 * * *" },
    { "path": "/api/cron/compute", "schedule": "0 5 * * *" }
  ]
}


Each cron Route Handler

Validate User-Agent contains vercel-cron.

Generate jobRunId; write job_runs.start.

Call Convex HTTP Action (/api/run/... or convex.site/...).

On success/failure: write job_runs.finish and, if failure, write errors.

On success: POST /api/revalidate with relevant tags.

14) Testing strategy (no extra services)

Unit (Vitest)

OData client pagination/retry.

COSIF CSV parser (delimiter/encoding).

Math (delta, median, stdev, ranking).

Integration (Vitest + MSW/fixtures)

Full ingest of a small IF.Data window into Convex (mocked HTTP).

Full ingest of a month of COSIF (fixtures) → series persisted.

Compute step builds rankings.

E2E (Playwright, automated only)

/relatorio/[slug] renders cards, charts, ranking, footers; export CSV works.

/relatorio/[slug]/ifdata/[id] shows expected quarterly data and ranking.

Compare flow basic path.

Traces: retain-on-failure.

CI scripts only (no manual runner in prod).

15) Security & compliance

Only public data; show license/source on “About” and footers.

Sanitize all inputs with zod.

Rate‑limit search/autocomplete server‑side.

Protect /api/health and cron routes (UA/secret header).

No secrets printed/logged.

16) Performance & UX polish

Downsample long series in the browser; server can provide pre‑bucketed views on request.

Virtualized tables (TanStack + shadcn table) for large rankings.

Lazy‑load heavy UI segments; avoid chart renders below the fold.

Accessible labels/tooltips; keyboard navigation for tables and dialogs.

17) Backlog (post‑launch)

4040 (consolidated) toggle and /conglomerado.

More IF.Data reports via discovery.

Correlation matrix and distribution explorer.

Public read‑only mini‑API (tRPC subset → REST) if needed later.

18) Phased execution with CHECKLISTS & CHECKPOINTS

Each phase ends with an automated checkpoint—LLM must produce artifacts and run the specified commands. If a checkpoint fails, halt and fix before proceeding.

Phase A — Bootstrap & Environment

Checklist

 Create Next.js 16 app with TS & App Router.

 Install deps: @trpc/server @trpc/client @trpc/react-query zod convex adm-zip csv-parse recharts tailwindcss shadcn-ui @tanstack/react-table msw vitest playwright (adjust names if scaffold scripts differ).

 Initialize Convex (npx convex dev structure).

 Add app/api/trpc/[trpc]/route.ts with fetchRequestHandler.

 Add Tailwind + shadcn init; scaffold base components.

 Create server/logging/logger.ts and handleError.ts.

 Confirm .env.local has CONVEX_*, BLOB_*, and data source URLs. Do not print values.

Checkpoint A (automated)

Run pnpm build → succeeds.

Run a health script that imports env keys and verifies presence (without printing secrets).

pnpm dev boots Next and Convex locally; GET /api/health returns {ok:false, reason:"no runs yet"}.

Phase B — Convex schema & seed

Checklist

 Implement convex/schema.ts with tables/indexes listed in §4.

 Create convex/migrations if needed; push schema.

 Implement convex/institutions.ts::sync(); scripts/backfill_slugs.ts.

 Implement scripts/bootstrap_indicators.ts to seed IF.Data reports and COSIF dictionary (level‑3 → indicator mapping).

Checkpoint B

Run pnpm convex:push (or equivalent) → ok.

Run node scripts/bootstrap_indicators.ts → indicators populated (≥ 6 IF.Data, ≥ 8 COSIF).

Run node scripts/backfill_slugs.ts after institutions.sync() → institutions table has ≥ N entries with slug.

Phase C — Clients & ingestion (IF.Data)

Checklist

 Implement server/clients/odata.ts (retry/backoff, @odata.nextLink).

 Implement convex/ingest_ifdata.ts::refresh({windowQuarters}).

 Implement lineage recording and optional Blob archival for IF.Data JSON.

 Add unit tests for OData client; integration test for a small window (mocked responses).

Checkpoint C

Run integration test: pnpm test → ensures series has quarterly points for selected indicators across ≥ 8 quarters.

lineage has entries for IF.Data pulls.

Phase D — Clients & ingestion (COSIF)

Checklist

 Implement server/clients/cosif.ts (download, unzip, parse).

 Implement convex/ingest_cosif.ts::refresh({...}) with mapping via COSIF dictionary.

 Write unit tests for CSV parser & aggregator.

 Add Blob archival of raw ZIP and optional normalized CSV; write lineage.

Checkpoint D

Run integration test ingesting 1–2 months of fixtures → series has monthly values for ≥ 8 COSIF indicators.

lineage shows ZIP stored and hashed; no parser errors.

Phase E — Compute layer

Checklist

 Implement server/math/{stats,ranking,resampling}.ts.

 Implement convex/compute.ts::rebuild({periods}).

 Add tests verifying deterministic ranks, ties, percentiles.

Checkpoint E

Run compute on current data → rankings populated for latest Q and M periods; tests pass.

Phase F — tRPC contracts & UI

Checklist

 Build routers: institutions, indicators, series, rankings, compare, search.

 Create /relatorio/[slug] page (SSR), KpiCards, TimeSeries, CosifTree, RankingTable, SourceFootnote.

 Create /relatorio/[slug]/ifdata/[id] page.

 Implement CSV export flow → push to Blob → return URL.

 Apply caching tags and revalidate on ingest/compute.

Checkpoint F

Manual render under seeded fixtures in dev: pages load, charts/tables show data; export returns a valid Blob URL; footers show sources.

Phase G — Cron wiring & health

Checklist

 vercel.json with three cron entries.

 app/api/cron/* handlers → call Convex HTTP Action; write job_runs start/finish; errors on failure.

 /api/revalidate endpoint to receive tags.

Checkpoint G

Simulate cron calls locally (with UA override) → mutations fire, job_runs updated, revalidation invoked (log entry), pages reflect new data.

Phase H — Testing (Playwright automated only)

Checklist

 Vitest unit/integration suite green.

 Playwright specs for pages and exports; trace: retain-on-failure.

 CI scripts test, test:e2e, and caching configured (optional Turborepo).

Checkpoint H

CI run → all tests pass; artifacts only on failure.

Phase I — Launch readiness

Checklist

 About/Fontes page with license/source text.

 Rate limiting for search/autocomplete.

 /api/health protected by header check.

 Log format validated in Vercel dashboard; error injection test recorded in errors.

Checkpoint I

Dry run of a full day: IF.Data cron (no‑op if no new data), COSIF cron (mock month), compute cron → all job_runs success; UI shows new data; no uncaught errors.

19) Implementation snippets (orientation only)

LLMs: adapt names if templates differ; always read env from process.env.

tRPC Route Handler

// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/context';
export const runtime = 'nodejs';
const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: '/api/trpc', router: appRouter, req, createContext });
export { handler as GET, handler as POST };


Revalidation endpoint

// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
export async function POST(req: Request) {
  const { tags } = await req.json();
  for (const t of tags) revalidateTag(t);
  return Response.json({ ok: true, tags });
}


Cron handler (pattern)

// app/api/cron/ifdata/route.ts
import { logger } from '@/server/logging/logger';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  if (!req.headers.get('user-agent')?.includes('vercel-cron')) return new Response('forbidden', { status: 403 });
  const runId = `ifdata-${Date.now()}`;
  logger.info({ scope: 'cron.ifdata', msg: 'start', ctx: { runId } });
  try {
    await fetch(`${process.env.CONVEX_SITE_URL}/ingest/ifdata`, { method:'POST' });
    logger.info({ scope: 'cron.ifdata', msg: 'done', ctx: { runId } });
    return Response.json({ ok: true });
  } catch (e:any) {
    logger.error({ scope: 'cron.ifdata', msg: 'failed', err: { message: e?.message } , ctx: { runId } });
    return new Response('error', { status: 500 });
  }
}


Logger

// server/logging/logger.ts
export const logger = {
  info:  (o:any) => console.log(JSON.stringify({ ts: Date.now(), level:'info',  ...o })),
  warn:  (o:any) => console.log(JSON.stringify({ ts: Date.now(), level:'warn',  ...o })),
  error: (o:any) => console.error(JSON.stringify({ ts: Date.now(), level:'error', ...o }))
};


OData fetch (paged)

// server/clients/odata.ts
export async function odataFetch(base: string, entity: string, params: Record<string,string|number> = {}) {
  const usp = new URLSearchParams({ $format: 'json', ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) });
  let url = `${base.replace(/\/$/, '')}/${entity}?${usp.toString()}`;
  const rows:any[] = [];
  for (let i=0; i<1024; i++) {
    const r = await fetch(url, { headers: { accept:'application/json' } });
    if (!r.ok) throw new Error(`OData ${entity} ${r.status}`);
    const j:any = await r.json();
    rows.push(...(j.value ?? []));
    if (!j['@odata.nextLink']) break;
    url = j['@odata.nextLink'];
  }
  return rows;
}


COSIF ZIP parse

// server/clients/cosif.ts
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
export function parseCosifZip(zipBuf: Buffer) {
  const zip = new AdmZip(zipBuf);
  return zip.getEntries()
    .filter(e => e.entryName.toLowerCase().endsWith('.csv'))
    .flatMap(e => parse(e.getData().toString('latin1'), { columns:true, delimiter:';', skip_empty_lines:true }));
}

20) LLM execution rules (meta)

Never prompt a human. If data is missing, choose a sensible default or skip with a logged warning; do not block.

Idempotent writes: all ingest/compute steps must be safe to re‑run.

Small, verifiable steps: after each phase, run its checkpoint; on failure, stop and fix.

No secret exposure: never print env values; only check existence.

Deterministic outputs: statistics/rankings must not depend on iteration order; document tie‑breaks.

Cite source in UI: every chart/table shows its origin (IF.Data or COSIF) and frequency (Q or M).

Blob only for artifacts: never use Blob as a query store; Convex is the database.

Tests first for parsers: write unit tests before ingesting real data.

Final remarks

This plan is LLM‑operable: every unit of work has inputs, outputs, and a checkpoint. It respects your constraints (Convex DB, Vercel Cron with Convex, no Sentry, Playwright only for automation) and adds operational guardrails (lineage, logging, health) without extra vendors.

If you want, I can now produce a task queue (JSON) that a multi‑agent runner can consume, where each task references these checklists and emits artifacts ready for the next phase.