# Baseline Operacional — novembro/2025

## Contexto
- Data da coleta: 03 nov 2025
- Branch: main (pré-implementação do plano Tier S)
- Ambiente local com `.env.local` atualizado (inclui `CHARTIMG_SECRET_KEY`)

## Métricas coletadas
| Indicador | Valor | Observações |
| --- | --- | --- |
| Duração média `news-orchestrator` | ~318 s (smoke-e2e) | Descoberta levou ~317,5 s para retornar 11 itens. |
| Itens descobertos | 11 | 1 item fora da whitelist (investing.com) descartado no parsing. |
| Itens após prefilter | 0 → 7 | 03/11 15h: baseline com 0 itens; 03/11 15h43 (após ajustes) prefilter manteve 7/11. |
| Taxa de duplicatas descartadas | n/a | Stage dedup não executado (sem itens). |
| Envio Telegram | 0 mensagens | Pipeline interrompido antes do sender. |
| `npm run test` | ✅ | Todos os 13 testes passaram (Vitest 4). |
| `npx tsc --noEmit` | ✅ | Sem erros de tipo. |
| `npm run test:e2e` | ❌ | Falha por `Prefilter stage não passou nenhuma notícia` (registrado em logs abaixo). |

## Logs relevantes
```txt
03:03 run — prefilter 0/11
{"level":"info","message":"stage.discovery.start","timestamp":"2025-11-03T18:03:55.165Z","total":11,"structured":12}
{"level":"info","message":"stage.prefilter.complete","timestamp":"2025-11-03T18:03:55.166Z","total":11,"passed":0,"discarded":11}
Pipeline falhou: Prefilter stage não passou nenhuma notícia

15:43 run — prefilter 7/11, dedup 0 descartes
{"level":"info","message":"stage.prefilter.complete","timestamp":"2025-11-03T18:43:28.228Z","total":11,"passed":7,"discarded":4}
{"level":"info","message":"stage.dedup.complete","timestamp":"2025-11-03T18:43:56.206Z","duplicates":0,"passing":5}
```

## Conclusões iniciais
- A descoberta está lenta (~5 min), reforçando prioridade do Estágio 1.
- Prefilter após ajustes mantém 7/11 itens; comparar runs futuros para checar regressões.
- Resultado agregado agora inclui métricas por canal (`channels[]`); monitorar status por canal após cada deploy.
- Necessário revisar heurísticas e manter smoke-e2e como indicador após cada etapa do plano.
- Smoke commentary rodou em 03/11 (script dedicado) retornando comentário válido em ~14s com 192 caracteres, funcionando como referência de tom.

---

## Pós-implementação parcial (03 nov 2025 — 20h15)
- Branch: main com estágios 0–3 concluídos.
- `npm run test:e2e` (log `/tmp/smoke-e2e.log`):
  - Duração total: **393.90 s** (↓ ~24% vs baseline).
  - Discovery: 12 itens em 249.99 s.
  - Prefilter: 12 → 7; Rerank: 7 → 5; Dedup: 5 (0 duplicatas).
  - Summarize: 111.54 s (5 itens).
- Comentário automatizado: ✅ (220 caracteres, 2 frases).
- Chart-IMG: ✅ (PETR4, 1M/1D, cache armazenado e quota 2/h respeitada).
- Observação: resultados confirmam eficiência da pipeline mesmo com features adicionais; discovery continua principal gargalo (< 4 min meta).
