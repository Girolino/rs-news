# Playbook — Adicionar novo canal RS News

## 1. Preparação
- Defina objetivo/editorial do canal (ex.: small caps, macro global).
- Liste necessidades específicas: tópicos adicionais, domínios extras, filtros de tickers/categorias, chatId destino.
- Valide se há capacidade de agenda (evitar concorrência com canais existentes no mesmo horário).

## 2. Configuração (`src/config/channels.ts`)
1. Importar `loadEnv` se o chatId for mantido em variáveis de ambiente.
2. Adicionar item no array `CHANNELS` com:
   - `id`: identificador único (`small-caps`, `macro-br`, …).
   - `label`: nome amigável para logs.
   - `chatId`: ID/username do canal ou fallback `loadEnv().TELEGRAM_CHAT_ID`.
   - `discovery.additionalTopics`: tópicos extras específicos (strings).
   - `discovery.whitelist`: domínios suplementares (quando necessário).
   - `thresholds`: overrides opcionais (`maxNewsPerRun`, `relevanceThreshold`, `dedupSimilarityThreshold`, `simhashDistanceThreshold`).
   - `filters`: `allowedTickers`/`allowedCategories` para restringir conteúdo.
   - `features`: `commentary`/`chartImg` para habilitar/desabilitar recursos por canal.

## 3. Segredos & Variáveis
- Garantir que o novo `chatId` esteja sincronizado no ambiente (Trigger.dev e Vercel se aplicável).
- Se o canal exigir APIs adicionais, registrar chaves e atualizar `docs/ops/env-sync-log.md`.

## 4. Testes
1. Rodar `npm run test` e `npx tsc --noEmit`.
2. Executar `npm run smoke:commentary` se o canal usar comentários.
3. Executar `npm run smoke:chartimg` caso `chartImg` esteja habilitado.
4. Rodar `npm run test:e2e` e verificar se o novo canal aparece em `channels` do output agregador.
5. Validar manualmente no Trigger.dev (dev environment) usando `news-sender` com payload contendo o novo `channelId`.

## 5. Rollout
- Ativar canal inicialmente com `features.commentary/chartImg` desligados (flag gradual).
- Monitorar `orchestrator.complete` → `channels` para conferir métricas individuais.
- Atualizar `docs/llm-guide/rs-news-llm-handbook.md` e baseline com novos resultados.
- Programar alerta no dashboard/admin para acompanhar volume e falhas por canal.

## 6. Checklist rápido
- [ ] Config criado em `channels.ts` com `id` e `chatId` válidos.
- [ ] Segredos sincronizados.
- [ ] Tests (unit + e2e) executados localmente.
- [ ] Smoke(s) rodados conforme features.
- [ ] Documentação atualizada (handbook + playbook + env log).
- [ ] Deploy Trigger.dev → staging → produção.
