# Experimentos de Deduplicação — novembro/2025

## Configuração
- Data: 03 nov 2025
- Branch: trabalho atual (após implementação de SimHash)
- Env:
  - `DEDUP_SIMILARITY_THRESHOLD=0.9`
  - `DEDUP_SIMHASH_DISTANCE_THRESHOLD=12`
  - `DISCOVERY_DYNAMIC_TOPIC` vazio

## Execução
- 03/11 15:10 — `npm run test:e2e` → ❌ (prefilter descartou 10/10 itens; dedup não exercitado)
- 03/11 15:43 — `npm run test:e2e` → ✅ (`prefilter` 11→7, `rerank` 7→5, `dedup` 0 descartes; summarização completou 5 itens)
- 03/11 20:12 — `npm run test:e2e` → ✅ (`prefilter` 12→7, `dedup` 0 descartes, `summarize` 5 itens; duração total 393.90 s)
- Observação: manter coleta de dumps para medir distâncias de SimHash vs. score Upstash; próximo passo é registrar SA e NA de duplicatas reais.

## Próximos passos
1. Capturar dump de notícias reais que atravessam o prefilter para medir distância de SimHash na prática.
2. Após obter itens válidos, registrar:
   - Scores retornados pela busca Upstash.
   - Distâncias de Hamming entre candidatos.
   - Decisão final (descartado ou não).
3. Ajustar `DEDUP_SIMHASH_DISTANCE_THRESHOLD` conforme falsos positivos/negativos observados.
