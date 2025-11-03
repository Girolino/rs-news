# Chart-IMG Smoke Log — novembro/2025

- 2025-11-03 18:20 BRT — `npm run smoke:chartimg` → ✅ PETR4, range `1M`, intervalo `1D` (primeira execução pós wrapper).
- 2025-11-03 20:07 BRT — `node --import=tsx --import=dotenv/config scripts/smoke-chartimg.ts` → ✅ PETR4, range `1M`, intervalo `1D`; cache hit registrado (`chartimg.cache_store`).

Observações:
- Endpoint: `https://api.chart-img.com/v1/tradingview/advanced-chart/storage` (GET, header `Authorization: Bearer <CHARTIMG_SECRET_KEY>`).
- Limites: largura ≤ 800px; intervalos válidos conforme TradingView (`1D`, `1W`, `60`, etc.).
- Resposta inclui metadados (`expireAt`, `size`). Cache Redis configurado para 10 minutos. Quota horária controlada por chave `chartimg:quota:<YYYY-MM-DDTHH>`.
