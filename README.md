# RS News Agent

Pipeline automatizado que descobre, filtra, sumariza e envia notícias de economia e empresas brasileiras para um canal do Telegram. A execução padrão ocorre via cron job no Vercel (a cada hora), com suporte a disparos manuais via tRPC ou endpoints HTTP.

## Arquitetura

- **Framework**: Next.js 16 (App Router, runtime Node)
- **Orquestração**: `src/server/agent/orchestrator.ts` coordena os estágios (descoberta → filtro → rerank → dedup → sumarização → formatação → envio → persistência)
- **LLM**: OpenAI (`ai` SDK com createOpenAI)
- **Storage**: Upstash Redis (locks e persistência) + Upstash Search (deduplicação e indexação)
- **Mensageria**: Telegram Bot API (HTML sanitized)
- **Observabilidade**: logs estruturados em `logger.ts` + persistência do último run em Redis (`agent:news:last_run`)

## Diagramas

```
Vercel Cron ──► Orchestrator
                 │
                 ├── Stage 1: discovery (LLM + web search prompt)
                 ├── Stage 2: prefilter (heurísticas rápidas)
                 ├── Stage 3: rerank (LLM scoring)
                 ├── Stage 4: dedup (Upstash Search)
                 ├── Stage 5: summarize (LLM + citações)
                 ├── Stage 6: format (HTML seguro)
                 ├── Stage 7: send (Telegram API + retry)
                 └── Stage 8: persist (Redis + Search)
```

## Pré-requisitos

- Node.js ≥ 22 (vitest 4 requer engines atualizadas)
- Conta na OpenAI com acesso aos modelos `gpt-5-mini`
- Instâncias Upstash Redis e Upstash Search ativas
- Bot do Telegram com token e chat ID

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores reais:

```
OPENAI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_SEARCH_REST_URL=
UPSTASH_SEARCH_REST_TOKEN=
UPSTASH_SEARCH_INDEX=news-br
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRON_SECRET=optional-secret
NODE_ENV=development
MAX_NEWS_PER_RUN=10
RELEVANCE_THRESHOLD=7
DEDUP_SIMILARITY_THRESHOLD=0.9
```

> `CRON_SECRET` é recomendado para proteger os endpoints `/api/cron/news-agent` e `/api/admin/retry-failed` (Bearer token).

## Scripts

- `npm run dev` – desenvolvimento local (Next.js + App Router)
- `npm run lint` – ESLint sobre todo o projeto
- `npm run test` – suíte de testes (vitest)
- `npm run test:watch` / `npm run test:coverage`

## Testes

A suíte cobre:

- Utilitários (`hash`, `lock`, `formatter`, `validator`)
- Estágios de prefilter e dedup com mocks controlados
- Integração do orquestrador com pipeline mockado

Os testes executam com `vitest` e carregam `.env.local` via `vitest.setup.ts`. Não há chamadas reais para Upstash/Telegram durante os testes.

## Endpoints

| Método | Caminho | Descrição |
| ------ | ------- | --------- |
| `GET/POST` | `/api/cron/news-agent` | Dispara a execução completa (usado pelo Vercel Cron). Requer `Authorization: Bearer <CRON_SECRET>` se definido. |
| `POST` | `/api/admin/retry-failed` | Reenvia mensagens que falharam no Telegram e atualiza o estado. |
| tRPC | `news.runAgent` | Mutation para disparo manual programático. |

Dashboard simplificado disponível em `/` com referência rápida dos endpoints.

## Deploy (Vercel)

1. Configure as variáveis de ambiente no dashboard do Vercel.
2. Garanta que a chave `OPENAI_API_KEY` esteja configurada e com acesso ao modelo desejado (ex.: `gpt-5-mini`).
3. `vercel.json` inclui o cron `0 * * * *` e `maxDuration` de 300s para o endpoint.
4. Após deploy, teste manualmente:
   - `curl https://<deploy>/api/cron/news-agent -H "Authorization: Bearer $CRON_SECRET"`
   - Verifique logs no Vercel e mensagens no Telegram.

## Estrutura de pastas relevante

```
src/
  app/
    api/
      cron/news-agent/route.ts
      admin/retry-failed/route.ts
      trpc/[trpc]/route.ts
    layout.tsx
    page.tsx
  server/
    agent/
      orchestrator.ts
      stages/
    api/
      root.ts
      routers/news.ts
      trpc.ts
    lib/
      hash.ts
      lock.ts
      logger.ts
      retry.ts
    services/
      ai/
      storage/
      telegram/
  types/
    agent.ts
    news.ts
    telegram.ts
```

## Próximos passos sugeridos

- Ajustar prompts de descoberta para integrar uma ferramenta de web search real, caso disponha de provedor com essa capacidade.
- Adicionar monitoramento/alertas (ex: enviar log de falha para canal admin).
- Implementar dashboard administrativo com visualização dos últimos envios (reutilizando dados do Redis/Search).


```bash


npm run trigger:deploy -- --env prod

git add .; git commit -m '  v0.01.12 feat: monitoring & admin dash'; git push origin main
git reset --hard; git clean -fd; git checkout dev-branch; git pull origin dev-branch
git reset --hard c2366a1
git push --force origin dev-branch
