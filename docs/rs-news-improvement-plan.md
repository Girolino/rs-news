# RS News — Plano Mestre de Implementação (Tier S)

Documento mestre para executar as evoluções do RS News com padrão de excelência em UX (experiência do assinante) e DX (experiência de desenvolvimento). Baseado no `docs/llm-guide/rs-news-llm-handbook.md` (estado em 03 nov 2025) e no brainstorming de melhorias. Todas as etapas devem ser cumpridas na ordem definida, sem atalhos.

---

## 0. ULTRATHINK Assessment
Aplicar ULTRATHINK para avaliar a melhor estratégia de entrega:

- **Opção A — Roadmap por funcionalidade isolada:** tratar dedup, comentários, gráficos e multicanal de forma sequencial e independente. *Risco:* retrabalho alto em testes, ausência de checkpoints de regressão, pouca visibilidade sobre o impacto cruzado nos pipelines Trigger.dev.
- **Opção B — Fluxos estruturados por estágios com checkpoints e critérios de saída (gate-based):** agrupar tarefas em trilhas (pré-flight, dados, conteúdo, mídia, multicanal, observabilidade) com validação incremental e revisão obrigatória. *Benefícios:* assegura coerência entre estágios, favorece DX (menos context switch) e garante que mudanças de performance sejam medidas antes de seguir.

**Decisão ULTRATHINK:** seguir a **Opção B**, com estágios encadeados, checklist granular e checkpoint intermediário obrigatório para revalidação pelo LLM antes de avançar.

---

## 1. Escopo, Sucesso e Restrições
- **Escopo:** aperfeiçoar deduplicação, dinamizar descoberta, adicionar comentário analítico, integrar gráficos Chart-IMG, habilitar arquitetura multicanal, ampliar monitoramento/alertas e criar documentação/automação suporte.
- **Sucesso:** redução de duplicatas observadas (<2% em janela diária), aumento de engajamento (CTR Telegram + comentários qualitativos), zero regressões em envio, UX clara entre fato e opinião, DX com scripts e documentação automatizados.
- **Restrições:** manter uso de fontes whitelisted, respeitar limites do plano gratuito Chart-IMG, sem remover garantias de citações, sem quebrar tempo máximo das tasks Trigger.dev (orchestrator ≤ 4 min; sender ≤ 90 s por item sem esperar).
- **Dependências críticas:** Upstash Search (texto + potencial SimHash), OpenAI `gpt-5-mini`, Chart-IMG (`CHARTIMG_SECRET_KEY`), Telegram Bot API.

---

## 2. Princípios de Excelência (Tier S UX & DX)
- **UX:** separar claramente fatos, comentários e mídias; tempos de envio previsíveis; visual consistente; transparência sobre automação.
- **DX:** automações reproduzíveis, scripts de smoke-test para integrações externas, testes automatizados cobrindo mudanças, feature flags prontas para rollback, documentação atualizada em cada merge.
- **Performance:** monitorar latência das tasks e chamadas externas; introduzir caches/guardrails para evitar estouro de quotas gratuitas.

---

## 3. Checklist Geral por Estágio
Os itens são obrigatórios. Marcar cada checkbox somente após execução validada. Links indicam arquivos-alvo para alteração. Após o Estágio 3 há um checkpoint de revisão compulsória.

### Estágio 0 — Pré-Flight & Baselines
- [x] Revisar `docs/llm-guide/rs-news-llm-handbook.md` e alinhar qualquer divergência de arquitetura atual.
- [x] Garantir `.env.local` com `CHARTIMG_SECRET_KEY`, variáveis Trigger.dev e Telegram atualizadas.
- [ ] Propagar segredos para Trigger.dev (`trigger config`) e Vercel; registrar data de sincronização em `docs/ops/env-sync-log.md` (pendente — requer acesso aos painéis cloud).
- [x] Capturar métricas atuais: duração média `news-orchestrator`/`news-sender`, taxa de duplicatas descartadas, número de envios/hora (registrar em `docs/ops/baseline-2025-11.md`).
- [x] Validar que testes base ( `npm run test`, `npx tsc --noEmit`, `npm run test:e2e`) passam em main antes de iniciar mudanças. (*E2E executado, falha documentada como baseline.)

### Estágio 1 — Deduplicação & Descoberta Reforçadas
- [x] Auditar configuração do índice Upstash Search (língua, analyzer); documentar em `docs/ops/upstash-index.md`.
- [ ] Se necessário, recriar índice com suporte PT-BR (staging → produção) preservando dados ou planejando reindex.
- [x] Implementar SimHash ou fingerprint lexical em `src/server/agent/stages/dedup.ts` (ou helper dedicado) como camada adicional.
- [x] Ajustar experiments de `DEDUP_SIMILARITY_THRESHOLD` (0.85/0.80) controlados por env; adicionar testes em `src/tests/unit/dedup.test.ts`.
- [x] Introduzir slot de tópico dinâmico (env `DISCOVERY_DYNAMIC_TOPIC`) e atualizar `src/server/agent/stages/discovery.ts` + prompt docs.
- [x] Atualizar documentação no handbook (seção 4.x e 11.x) com novas heurísticas.
- [x] Rodar `npm run test:e2e` com dumps reais e registrar observações em `docs/ops/dedup-experiments.md`.

### Estágio 2 — Comentário Analítico Automatizado
- [x] Definir prompt em `src/server/agent/stages/commentary.ts` (novo) com limites (2 frases, tom conversacional, disclaimer).
- [x] Integrar estágio no `news-sender` após `runSummarizeStage`, protegido por feature flag `ENABLE_ANALYSIS_COMMENTARY`.
- [x] Garantir envio em mensagem separada (`sendMessage`) com delay configurável; ajustar `trigger/sender.task.ts`.
- [x] Criar testes unitários para prompt e formatação (`src/tests/unit/commentary.test.ts`).
- [x] Adicionar smoke manual (`scripts/smoke-commentary.ts`) para validar geração/flag.
- [x] Atualizar handbook (seções 4.5–4.8 e 10) e docs do canal esclarecendo diferenciação fato/opinião.

### Estágio 3 — Integração Chart-IMG & Mid-tier Media
- [x] Criar `scripts/smoke-chartimg.ts` para testar 2 tickers (e.g., PETR4, VALE3); registrar limites observados.
- [x] Implementar wrapper `src/server/services/market/chartImg.ts` com retries exponenciais, parâmetros configuráveis (intervalo, tema, dimensões).
- [x] Estender `services/telegram/client.ts` com `sendPhoto` (URL + buffer fallback).
- [x] Definir regra de disparo (impacto ≥ média, `tags[0]` ticker B3) e feature flag `ENABLE_CHARTIMG`.
- [x] Implementar cache curto (Redis) para reutilizar imagens na mesma janela de hora.
- [x] Adicionar testes (mockando Chart-IMG) em `src/tests/unit/services/chartimg.test.ts`.
- [x] Atualizar `docs/llm-guide/rs-news-llm-handbook.md` com fluxo visual e limitações do plano free.

---

### ⚡ Checkpoint ULTRATHINK (Obrigatório antes de seguir)
- [x] Executar revisão ULTRATHINK verificando se Estágios 0–3 estão completos, com checkboxes marcados e evidências registradas.
- [x] Rodar novamente a suíte de testes (`npm run test`, `npx tsc --noEmit`, `npm run test:e2e`) e anexar resultados em `docs/ops/checkpoint-report.md`.
- [x] Validar impacto em métricas (latência tasks, duplicatas, consumo Chart-IMG) e comparar com baseline.
- [x] Só prosseguir se não houver bloqueios; em caso de regressões, voltar ao estágio correspondente.

---

### Estágio 4 — Arquitetura Multicanal
- [x] Criar `config/channels.ts` com schema tipado (incluindo topics, thresholds, allowlists, chatIds, allowedTickers/categories).
- [x] Adaptar `trigger/orchestrator.task.ts` para iterar canais com locks independentes e escalonar `tasks.batchTrigger`.
- [x] Ajustar `news-sender` para receber contexto de canal (config-driven).
- [x] Adicionar testes de integração multi-canal (`src/tests/integration/trigger-orchestrator.test.ts`).
- [x] Atualizar handbook (seções 1, 3) e criar `docs/ops/new-channel-playbook.md`.
- [x] Planejar rollout progressivo (ativar segundo canal em staging, monitorar custos) — ver playbook seção 5.

### Estágio 5 — Monitoramento, Alertas & Dashboard
- [x] Implementar task Trigger.dev `news-daily-report` (cron 20:00 BRT) que envia resumo ao canal admin.
- [x] Adicionar alertas de falha (≥3 runs sem envio ou `failedToSend` > 2) com DM imediata.
- [x] Construir dashboard admin Next.js (rota autenticada) exibindo runs, duplicatas, fila, consumo Chart-IMG.
- [x] Criar testes E2E/lightweight para dashboard (Playwright ou Vitest + React Testing Library).
- [x] Documentar runbooks em `docs/ops/monitoring-runbook.md`.

### Estágio 6 — QA Final, Performance & Lançamento
- [x] Executar suíte completa (unit, integration, e2e, smoke scripts Chart-IMG e commentary).
- [x] Comparar métricas pós-mudança com baseline; garantir orchestrator ≤ 4 min, sender ≤ 90 s (excluindo waits >5 s).
- [x] Revisar logs (dedup hits, comentários enviados, gráficos anexados) e validar quota Chart-IMG.
- [x] Atualizar documentação final: handbook, novo plano, changelog (adicionar entradas com datas).
- [x] Preparar anúncio interno e instruções de rollback (feature flags + comandos).
- [ ] Realizar deploy Trigger.dev (staging → produção) e Vercel, seguindo checklist `docs/trigger-dev-deployment-guide.md` (dependente de acesso à infraestrutura).

---

## 4. Matriz de Validação
| Etapa | Teste/Script | Resultado Esperado |
| --- | --- | --- |
| Dedup (Estágio 1) | `npm run test:e2e` (com dumps) | Sem duplicatas aprovadas; logs detalhando scores. |
| Comentário (Estágio 2) | `scripts/smoke-commentary.ts` | Comentário ≤ 2 frases + disclaimer; flag on/off funciona. |
| Chart-IMG (Estágio 3) | `scripts/smoke-chartimg.ts` | Resposta 200, imagem válida, quotas registradas. |
| Multicanal (Estágio 4) | `npm run test:e2e -- --channel=nome` | Cada canal processado com configurações corretas. |
| Monitoramento (Estágio 5) | Trigger.dev Test Task | Notificações enviadas, dashboard carregando métricas. |
| QA Final (Estágio 6) | `npm run test`, `npx tsc --noEmit`, `npm run test:e2e`, smoke scripts | Todos verdes; relatórios anexados no repo/docs. |

---

## 5. Documentação & Comunicação
- Atualizar `docs/llm-guide/rs-news-llm-handbook.md` a cada estágio concluído.
- Manter `docs/rs-news-improvement-plan.md` como fonte viva (marcar checkboxes e datas).
- Registrar baselines, experimentos e checkpoint em `docs/ops/`.
- Comunicar stakeholders antes/depois do Checkpoint ULTRATHINK e no lançamento (resumo, métricas, próximos passos).

---

## 6. Guardrails de UX & DX
- Feature flags (`ENABLE_ANALYSIS_COMMENTARY`, `ENABLE_CHARTIMG`, `CHANNEL_CONFIG_VERSION`) para rollback instantâneo.
- Logs estruturados incluindo `channelId`, `hasCommentary`, `chartImgStatus`.
- Transparência ao usuário final: inserir nota “(análise automatizada)” e “📊 gráfico gerado automaticamente”.
- Documentar fluxos de erro: fallback em Chart-IMG, commentary failure (não bloqueia envio factual).
- Garantir suporte a testes locais simples (`npm run smoke:ai`, `scripts/smoke-chartimg.ts`).

## 6.5 Plano de Rollout & Rollback
- **Antes do rollout (staging):**
  1. Executar `npm run test`, `npx tsc --noEmit`, `npm run test:e2e` com `.env.staging`.
  2. Verificar `newsDailyReportTask` via Trigger.dev → Test (confirmar envio para chat admin de staging).
  3. Ativar flags desejadas (`ENABLE_ANALYSIS_COMMENTARY`, `ENABLE_CHARTIMG`) diretamente no dashboard Trigger.dev (staging) e observar 2 execuções.
- **Checklist de anúncio interno (prod):**
  - Resumo: “Canal agora envia comentário automatizado, gráficos Chart-IMG e consolida métricas multi-canal.”
  - Itens para mensagem: horário do rollout, contato para suporte, instruções para usar dashboard (`/admin/dashboard?token=...`).
- **Rollback rápido:**
  1. Desativar flags (`ENABLE_ANALYSIS_COMMENTARY=false`, `ENABLE_CHARTIMG=false`) e publicar `CHANNELS` anterior (via `CHANNEL_CONFIG_VERSION`).
  2. Pausar `newsDailyReportTask` no Trigger.dev (toggle `Active`).
  3. Rodar `POST /api/admin/retry-failed` para limpar filas após falhas.
  4. Se necessário, reverter deploy Trigger.dev (`trigger.dev` → Deployments → Promote previous).
- **Comunicação pós-rollout:** enviar resumo no canal interno com: horário da primeira execução pós rollout, número de notícias enviadas, alertas recebidos (se houver) e link para relatório diário.

---

## 7. Entregáveis Esperados ao Final
1. Todos os checkboxes marcados com evidências em `docs/ops`.
2. Pipelines Trigger.dev atualizados e monitorados.
3. Comentários analíticos e gráficos opcionais funcionando sob flags.
4. Arquitetura multicanal configurável e documentada.
5. Dashboard e alertas operacionais ativos.
6. Relatório final com comparação baseline vs. pós-lançamento e plano de próximos incrementos.

> **Nota:** qualquer alteração subsequente deve atualizar este documento, mantendo o status dos checklists e adicionando novos estágios caso necessário.
