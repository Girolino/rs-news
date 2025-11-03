# Monitoring & Alerting Runbook — RS News

## 1. Componentes
- **Trigger.dev `newsDailyReportTask` (`trigger/monitoring.task.ts`)**  
  - Cron: 20h00 BRT (seg–sex).  
  - Fonte de dados: lista `agent:news:runs` (últimos 50 agregados) + chave `agent:news:last_run`.  
  - Destino: `TELEGRAM_ADMIN_CHAT_ID` (mensagem HTML).
- **Alertas imediatos (orchestrator & sender)**  
  - `news-orchestrator`: incrementa `agent:news:zero_send_streak`; envia alerta ao atingir 3 execuções consecutivas sem envio ou quando algum canal retorna `status = error`.  
  - `news-sender`: controla `agent:news:failed_send_counter`; após 3 falhas consecutivas, envia DM informando último `newsId` e `channelId` e reseta o contador.
- **Admin dashboard (`/admin/dashboard?token=...`)**  
  - Server component com acesso direto ao Redis.  
  - Exibe última execução, histórico recente (10 runs) e status por canal.  
  - Token configurado via `ADMIN_DASHBOARD_TOKEN`.

## 2. Pré-requisitos
1. Variáveis obrigatórias configuradas nos ambientes:
   - `TELEGRAM_ADMIN_CHAT_ID`
   - `ADMIN_DASHBOARD_TOKEN`
2. Redis acessível (Upstash) com permissões de leitura/escrita.
3. Deploy atualizado no Trigger.dev contendo `newsDailyReportTask`.

## 3. Operação diária
1. **Verificar mensagem das 20h:**  
   - Conteúdo esperado:
     ```
     📊 Relatório diário RS News (DD/MM/YYYY)
     • Execuções: X
     • Descobertas: Y
     • Enviadas: Z
     • Duplicatas filtradas: W

     Canais
     • default: 5 enviadas / 12 descobertas — success(5)
     ```
   - Ausência da mensagem → investigar Trigger.dev run (console) e logs.
2. **Monitorar alertas imediatos:**
   - Mensagem “Nenhuma notícia enviada...” → acionar smoke tests (`npm run test:e2e`) e verificar fontes de descoberta.
   - Mensagem “Falhas consecutivas no envio” → checar logs do `news-sender` e fila Trigger.dev; executar `POST /api/admin/retry-failed` após corrigir problema.
3. **Dashboard:**  
   - Acessar `https://<app>/admin/dashboard?token=<token>`  
   - Validar: hora da última execução, status por canal, número de duplicatas, execuções recentes.

## 4. Investigação de incidentes
1. **Alerta de zero envios**  
   - Passos:
     1. Trigger.dev → Runs → `news-orchestrator` → verificar logs `status: filtered_by_channel`/`none_relevant`.  
     2. Rodar `scripts/test-discovery.ts` para inspecionar set de candidatos.  
     3. Ajustar `CHANNELS` (thresholds/filtros) se filtragem estiver agressiva.
2. **Falhas consecutivas no sender**  
   - Passos:
     1. Trigger.dev → Runs → `news-sender` (últimos runs) → logs `sender.failed`.  
     2. Verificar disponibilidade da API Telegram (`https://api.telegram.org/bot<token>/getMe`).  
     3. Após estabilidade, rodar `POST /api/admin/retry-failed`.
3. **Relatório diário ausente**  
   - Verificar run `newsDailyReportTask` (Trigger.dev).  
   - Checar se `agent:news:runs` contém entradas (usar `redis-cli` ou dashboard Upstash).  
   - Confirmar `TELEGRAM_ADMIN_CHAT_ID` em Trigger.dev > Environment.

## 5. Comandos úteis
```bash
# Listar runs agregados (precisa de redis-cli ou HTTP Upstash)
curl "$UPSTASH_REDIS_REST_URL/lrange/agent:news:runs/0/9" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"

# Zerar contador de falhas (usar apenas após mitigação)
curl "$UPSTASH_REDIS_REST_URL/del/$FAILURE_COUNTER_KEY" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

## 6. Próximos incrementos
- Expandir relatório diário com métricas de comentários e gráficos (quantos enviados, quantos cache hits).  
- Conectar webhook/PagerDuty para alertas fora do horário comercial.  
- Adicionar gráficos históricos no dashboard (Sparkline dos últimos dias).

