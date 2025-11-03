# Registro de sincronização de segredos

| Data | Ambiente | Itens sincronizados | Observações |
| --- | --- | --- | --- |
| 2025-11-03 | Local (`.env.local`) | `CHARTIMG_SECRET_KEY`, `DEDUP_SIMHASH_DISTANCE_THRESHOLD`, `DISCOVERY_DYNAMIC_TOPIC`, `ENABLE_ANALYSIS_COMMENTARY`, `ANALYSIS_COMMENTARY_DELAY_SECONDS`, `ENABLE_CHARTIMG`, `CHARTIMG_DEFAULT_RANGE`, `CHARTIMG_DEFAULT_INTERVAL`, `CHARTIMG_DEFAULT_THEME`, `CHARTIMG_EXCHANGE`, `CHARTIMG_MAX_CALLS_PER_HOUR`, `TELEGRAM_ADMIN_CHAT_ID`, `ADMIN_DASHBOARD_TOKEN` | Ajustado baseline local para novos recursos (gráficos, SimHash, tópicos dinâmicos, comentários, alertas/admin dashboard). |
| 2025-11-03 | Trigger.dev (pendente) | _planejado_ | Sincronização será executada no Estágio 3 antes de habilitar gráficos. |
| 2025-11-03 | Vercel (pendente) | _planejado_ | Atualização coordenada com rollout de multicanal. |
