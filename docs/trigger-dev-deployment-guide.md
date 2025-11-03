# Trigger.dev Deployment Guide

Este guia explica como fazer o deployment das tasks do Trigger.dev para o RS News App.

## Visão Geral da Arquitetura

O sistema foi migrado do Vercel Cron para Trigger.dev para resolver dois problemas principais:

1. **Cron não respeitando horários**: Trigger.dev tem suporte nativo para timezones IANA
2. **UX de "vomitando notícias"**: Tasks agora são enviadas sequencialmente com delays aleatórios de 2-5 minutos

### Arquitetura de Tasks

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ORCHESTRATOR TASK (Scheduled)                           │
│    - Executa: Discovery → Prefilter → Rerank → Dedup       │
│    - Schedule: Segunda-Sexta 6h-19h (BRT)                 │
│    - Lock Redis: cron:news:lock evita execuções paralelas  │
│    - Dispara sender tasks em batch com delays incrementais  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. NEWS SENDER TASK (Queue com concurrency=1)              │
│    - Processa UMA notícia por vez                           │
│    - Wait aleatório (2-5 min, cap 30m) antes de enviar      │
│    - Executa: Summarize → Format → Send → Persist          │
│    - Retry automático (3 tentativas)                        │
└─────────────────────────────────────────────────────────────┘
```

## Pré-requisitos

1. **Conta Trigger.dev**
   - Criar conta em https://cloud.trigger.dev
   - Criar um novo projeto

2. **Variáveis de Ambiente**
   ```bash
   TRIGGER_PROJECT_REF=your-project-ref
   TRIGGER_API_KEY=your-api-key
   TRIGGER_API_URL=https://api.trigger.dev # (opcional)

   # Todas as variáveis existentes (OpenAI, Upstash, Telegram, etc)
   OPENAI_API_KEY=sk-...
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   UPSTASH_SEARCH_REST_URL=...
   UPSTASH_SEARCH_REST_TOKEN=...
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ```

## Setup Inicial

### 1. Login no Trigger.dev

```bash
npm run trigger:login
```

Isso abrirá o browser para autenticação.

### 2. Configurar Variáveis de Ambiente

No Trigger.dev dashboard (https://cloud.trigger.dev):

1. Vá para o seu projeto
2. Clique em **Settings** → **Environment Variables**
3. Adicione todas as variáveis de ambiente necessárias:
   - `OPENAI_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `UPSTASH_SEARCH_REST_URL`
   - `UPSTASH_SEARCH_REST_TOKEN`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `MAX_NEWS_PER_RUN` (opcional, default: 10)
   - `RELEVANCE_THRESHOLD` (opcional, default: 7)
   - `DEDUP_SIMILARITY_THRESHOLD` (opcional, default: 0.9)

4. Configure para os ambientes desejados (Development, Staging, Production)

### 3. Deploy para Staging

```bash
# Deploy para staging
npm run trigger:deploy --env staging
```

### 4. Validar Deployment

1. Vá para o dashboard do Trigger.dev
2. Navegue para **Tasks**
3. Verifique que as duas tasks aparecem:
   - `news-orchestrator`
   - `news-sender`
4. Clique em **Schedules** e verifique que o schedule está ativo:
   - Segunda-Sexta: `0 6-19 * * 1-5` (America/Sao_Paulo)

### 5. Teste Manual

No dashboard do Trigger.dev:

1. Vá para a task `news-orchestrator`
2. Clique em **Test**
3. Execute um teste com payload vazio `{}`
4. Monitore a execução no dashboard
5. Verifique que as tasks de sender são disparadas
6. Confirme que as notícias chegam no Telegram com delays

## Deploy para Production

### 1. Validar Staging

Antes de fazer deploy para production, certifique-se que:

- [ ] As tasks rodam sem erros no staging
- [ ] Os schedules estão funcionando corretamente
- [ ] As notícias chegam no Telegram com delays adequados
- [ ] Não há duplicatas
- [ ] Os custos estão dentro do esperado

### 2. Deploy

```bash
# Deploy para production
npm run trigger:deploy --env production
```

### 3. Ativar Schedules

No dashboard:

1. Vá para **Schedules**
2. Certifique-se que o schedule está **Enabled** no environment Production
3. Verifique os próximos horários de execução (campo **Next 5 runs**)

## Desenvolvimento Local

### 1. Dev Server

Para testar as tasks localmente:

```bash
npm run trigger:dev
```

Isso inicia o dev server do Trigger.dev que conecta com o cloud.

### 2. Testar Orchestrator

Em outro terminal, no dashboard local (geralmente http://localhost:3040):

1. Selecione a task `news-orchestrator`
2. Clique em **Test**
3. Execute com payload vazio
4. Monitore os logs no terminal

### 3. Testar Sender

Para testar apenas o sender:

1. Primeiro, execute o orchestrator para gerar notícias reranked
2. Ou crie um payload mock manualmente
3. Teste a task `news-sender` com um payload de exemplo

## Monitoramento

### Dashboard Trigger.dev

O dashboard fornece:

- **Runs**: histórico de todas as execuções
- **Logs**: logs detalhados de cada run
- **Metrics**: duração, custos, taxas de sucesso/falha
- **Alerts**: configure alertas para falhas

### Logs Estruturados

As tasks continuam usando o logger estruturado existente:

```typescript
logger.info("orchestrator.complete", {
  discoveredCount: 15,
  queuedForSendingCount: 8,
  executionTimeMs: 123456,
});
```

### Metadata Tracking

As tasks usam metadata para tracking de progresso:

```typescript
metadata.set("stage", "discovery");
metadata.set("progress", 10);
```

Isso aparece no dashboard em tempo real.

## Troubleshooting

### Tasks não estão sendo descobertas

Verifique que:
- O arquivo `trigger/index.ts` existe e exporta as tasks
- O `trigger.config.ts` aponta para o diretório correto (`dirs: ["./trigger"]`)
- Rode `npm run trigger:dev` e verifique os logs

### Schedules não estão rodando

Verifique que:
- Os schedules estão **Enabled** no dashboard
- O environment correto está selecionado (Dev/Staging/Production)
- O timezone está correto (`America/Sao_Paulo`)
- A task foi deployada com sucesso

### Falhas de Retry

A task de sender tem retry automático (3 tentativas). Se continuar falhando:

1. Verifique os logs no dashboard
2. Verifique as credenciais do Telegram
3. Verifique rate limits do Telegram
4. Verifique se o Redis/Search estão acessíveis

### Custos Inesperados

Monitore os custos no dashboard:
- **Compute**: tempo de execução das tasks
- **Waits > 5s**: não contam para compute
- **Machine sizes**: orchestrator usa `medium-1x`, sender usa `small-1x`

Se os custos estiverem altos:
- Reduza a frequência dos schedules
- Otimize o discovery stage
- Reduza o número máximo de notícias por run

## Rollback

Se algo der errado e precisar voltar para o Vercel Cron:

1. **Desativar schedules no Trigger.dev**
   - Dashboard → Schedules → Disable

2. **Reativar Vercel Cron**
   ```bash
   # Edite vercel.json
   # Mude "_crons_disabled" para "crons"
   git commit -am "Rollback to Vercel cron"
   git push
   ```

3. **Redeploy Vercel**
   - O deploy automático do Vercel vai reativar o cron

## Migração Gradual (Recomendado)

Para uma migração segura, recomendamos rodar em paralelo:

### Fase 1: Validação (1 semana)
- Trigger.dev rodando em staging
- Vercel cron continuando em production
- Comparar resultados

### Fase 2: Produção Dual (3-7 dias)
- Trigger.dev rodando em production
- Vercel cron ainda ativo (como backup)
- Monitorar ambos

### Fase 3: Desativar Vercel (após validação)
- Desativar Vercel cron
- Manter apenas Trigger.dev

## Comandos Úteis

```bash
# Login
npm run trigger:login

# Dev server local
npm run trigger:dev

# Deploy para staging
npm run trigger:deploy --env staging

# Deploy para production
npm run trigger:deploy --env production

# Listar tasks
npx trigger.dev list-tasks

# Ver logs de uma run específica
npx trigger.dev runs view <run-id>

# Cancelar uma run
npx trigger.dev runs cancel <run-id>

# Replay uma run
npx trigger.dev runs replay <run-id>
```

## Recursos Adicionais

- **Documentação Trigger.dev**: https://trigger.dev/docs
- **Dashboard**: https://cloud.trigger.dev
- **Suporte**: https://trigger.dev/discord
- **Status**: https://status.trigger.dev

## Custos Estimados

Com base na configuração atual:

**Orchestrator Task:**
- Frequência: ~68 execuções/mês (Mon-Fri: 14h/day, Sat: 5h/day)
- Duração média: ~2-3 minutos
- Machine: medium-1x (1 vCPU, 2 GB RAM)
- Custo estimado: ~$5-10/mês

**Sender Tasks:**
- Frequência: ~5-10 notícias por orchestrator run
- Duração média: ~30-60 segundos (excluindo waits)
- Machine: small-1x (0.5 vCPU, 0.5 GB RAM)
- Waits (2-5 min): não contam para compute
- Custo estimado: ~$5-15/mês

**Total estimado**: $10-25/mês (vs $0 do Vercel cron)

**Nota**: Waits maiores que 5 segundos não contam para uso de compute, então os delays de 2-5 minutos entre notícias são grátis.

## Support

Em caso de problemas:

1. Verifique os logs no dashboard do Trigger.dev
2. Consulte a documentação: https://trigger.dev/docs
3. Entre no Discord: https://trigger.dev/discord
4. Abra issue no GitHub do projeto (se aplicável)
