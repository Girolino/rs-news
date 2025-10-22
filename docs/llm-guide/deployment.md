# Guia de Deploy - RS News

Documentação completa para deployment em produção do sistema de curadoria de notícias com IA.

## Status da Implementação

**Data**: 22 de Outubro de 2025
**Status**: ✅ Pronto para produção
**Testes E2E**: 100% de sucesso
**Bugs críticos**: 0

## Visão Geral

O RS News é um sistema agentic que:
1. **Descobre** notícias brasileiras via web search (OpenAI Responses API)
2. **Filtra e ranqueia** usando IA para relevância
3. **Remove duplicatas** via Upstash Search
4. **Sumariza** com citations estruturadas
5. **Formata** para HTML do Telegram
6. **Envia** automaticamente para canal Telegram
7. **Persiste** no Redis e Vector Database

## Arquitetura

```
┌─────────────┐
│ Vercel Cron │ (scheduler)
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────────┐
│ /api/cron/news-agent                 │
│ ┌──────────────────────────────────┐ │
│ │ Pipeline de 8 Stages:            │ │
│ │                                  │ │
│ │ 1. Discovery   (~276s)           │ │
│ │    └─ OpenAI Web Search          │ │
│ │                                  │ │
│ │ 2. Prefilter   (<1s)             │ │
│ │    └─ Remove irrelevantes        │ │
│ │                                  │ │
│ │ 3. Rerank      (~22s)            │ │
│ │    └─ IA scoring                 │ │
│ │                                  │ │
│ │ 4. Dedup       (~1.6s)           │ │
│ │    └─ Upstash Search             │ │
│ │                                  │ │
│ │ 5. Summarize   (~117s)           │ │
│ │    └─ IA structured output       │ │
│ │                                  │ │
│ │ 6. Format      (<1s)             │ │
│ │    └─ HTML Telegram              │ │
│ │                                  │ │
│ │ 7. Send        (<1s)             │ │
│ │    └─ Telegram Bot API           │ │
│ │                                  │ │
│ │ 8. Persist     (<1s)             │ │
│ │    └─ Redis + Vector             │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
       │
       ↓
┌──────────────┐
│ Telegram     │
│ Channel      │
└──────────────┘
```

**Tempo total médio**: 7 minutos
**Margem de segurança**: 8 minutos (timeout Vercel: 15 min)

## Pré-requisitos

### 1. OpenAI API
- ✅ Conta com créditos
- ✅ Modelo: `gpt-5-mini` (ou superior)
- ✅ Web Search habilitado (Responses API)

### 2. Upstash
- ✅ Redis database (KV)
- ✅ Search index criado (`news-br`)

### 3. Telegram
- ✅ Bot criado via @BotFather
- ✅ Bot adicionado como admin no canal
- ✅ Chat ID do canal obtido

### 4. Vercel
- ✅ Conta Vercel (Pro ou superior para crons)
- ✅ Projeto configurado

## Variáveis de Ambiente

Adicione estas variáveis no dashboard da Vercel (`Settings > Environment Variables`):

### Obrigatórias

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-xxx...

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABC-DEF...
TELEGRAM_CHAT_ID=@seu_canal  # ou -100123456789

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXx...

# Upstash Search
UPSTASH_SEARCH_REST_URL=https://xxx.upstash.io
UPSTASH_SEARCH_REST_TOKEN=AYYy...
UPSTASH_SEARCH_INDEX=news-br
```

### Opcionais (com valores padrão)

```bash
# Segurança
CRON_SECRET=seu_secret_aqui  # Recomendado para produção

# Configurações de pipeline
MAX_NEWS_PER_RUN=5                    # Default: 5
RELEVANCE_THRESHOLD=7.0               # Default: 7.0 (escala 0-10)
DEDUP_SIMILARITY_THRESHOLD=0.9        # Default: 0.9 (escala 0-1)
NODE_ENV=production                   # Default: development
```

## Configuração do Cron

### Opção 1: Via vercel.json

Crie/edite `vercel.json` na raiz do projeto:

```json
{
  "crons": [
    {
      "path": "/api/cron/news-agent",
      "schedule": "0 9,12,15,18 * * 1-5"
    }
  ]
}
```

**Schedules sugeridos**:

```bash
# Horário comercial (9h, 12h, 15h, 18h) em dias úteis
"0 9,12,15,18 * * 1-5"

# A cada 3 horas, todos os dias
"0 */3 * * *"

# Apenas pela manhã (9h) em dias úteis
"0 9 * * 1-5"

# Duas vezes ao dia (9h e 15h)
"0 9,15 * * *"
```

### Opção 2: Via Dashboard Vercel

1. Acesse `Settings > Cron Jobs`
2. Adicione novo cron
3. Path: `/api/cron/news-agent`
4. Schedule: escolha o horário (formato cron)

## Deployment

### Passo a Passo

1. **Commit e push das mudanças**:
```bash
git add .
git commit -m "chore: deploy production-ready pipeline"
git push origin main
```

2. **Deploy no Vercel**:
```bash
vercel --prod
```

Ou conecte via GitHub/GitLab no dashboard Vercel.

3. **Configure as variáveis de ambiente** no dashboard

4. **Configure o cron** (via `vercel.json` ou dashboard)

5. **Teste manualmente**:
```bash
curl -X POST https://seu-projeto.vercel.app/api/cron/news-agent \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

6. **Monitore os logs**:
```bash
vercel logs --follow
```

## Testes Antes do Deploy

Execute localmente para garantir que tudo funciona:

```bash
# 1. Teste básico de IA
npm run smoke:ai

# 2. Teste discovery isolado
npm run test:discovery

# 3. Teste E2E completo (mock telegram)
npm run test:e2e
```

**Resultados esperados**:
- ✅ Discovery: 10-15 notícias encontradas em ~5 min
- ✅ Pipeline completo: 5-6 notícias finais em ~7 min
- ✅ Nenhum erro de API ou timeout

## O Que Acontece em Produção

### Fluxo Completo

1. **Cron trigger** → Vercel chama `/api/cron/news-agent`
2. **Lock verificado** → Garante que apenas 1 execução roda por vez
3. **Pipeline executa** → 8 stages processam notícias
4. **Mensagens enviadas** → Bot posta no canal Telegram
5. **Métricas salvas** → Redis armazena resultado da execução

### Formato das Mensagens no Telegram

```
📰 Título da Notícia (<=80 chars)

Resumo executivo da notícia em 1-2 linhas...

• Bullet point 1 com informação-chave
• Bullet point 2 com dados relevantes
• Bullet point 3 com contexto adicional

🔗 Fontes: [InfoMoney](https://...) | [Valor](https://...)

#IBOV #BOLSA #RESULTADOS
```

### Métricas e Monitoramento

O endpoint retorna JSON com métricas:

```json
{
  "metrics": {
    "discoveredCount": 13,
    "filteredCount": 6,
    "relevantCount": 7,
    "duplicateCount": 1,
    "sentCount": 5,
    "failedCount": 0,
    "skippedCount": 8,
    "executionTimeMs": 417150
  },
  "sentNewsIds": [
    "a402666ded09...",
    "dd32c2f2d433...",
    // ...
  ]
}
```

## Configurações Hardcoded

Algumas configurações estão no código (não em ENV). São estáveis e raramente precisam mudar:

### Modelos de IA (`src/lib/ai/models.ts`)
```typescript
export const AI_MODELS = {
  discovery: "gpt-5-mini",
  rerank: "gpt-5-mini",
  summarize: "gpt-5-mini",
}
```

### Tópicos de Busca (`src/server/agent/stages/discovery.ts`)
```typescript
const SEARCH_TOPICS = [
  "notícias empresas brasileiras B3 hoje",
  "resultados trimestrais empresas brasileiras",
  "Selic BCB decisão Copom",
  "IPCA inflação Brasil",
  "fusões aquisições empresas Brasil",
  "fatos relevantes B3 CVM",
]
```

### Domínios Confiáveis (`src/server/agent/stages/discovery.ts`)
```typescript
const DOMAIN_WHITELIST = [
  "valor.globo.com",
  "infomoney.com.br",
  "estadao.com.br",
  "ri.b3.com.br",
  "investidor10.com.br",
  "moneytimes.com.br",
  "broadcast.com.br",
  "reuters.com",
  "exame.com",
  "cvm.gov.br",
  "bcb.gov.br",
]
```

Para alterar, edite os arquivos e faça novo deploy.

## Troubleshooting

### Timeout no Discovery (>5 min)

**Sintoma**: Pipeline timeout antes de completar
**Causa**: Web search muito lento ou muitas notícias
**Solução**:
1. Reduza `SEARCH_TOPICS` de 6 para 4 tópicos
2. Reduza `maxSteps` de 8 para 5 em `discovery.ts`

### Poucas Notícias Enviadas (<3)

**Sintoma**: Pipeline completa mas envia apenas 1-2 notícias
**Causa**: Filtros muito restritivos
**Solução**:
1. Reduza `RELEVANCE_THRESHOLD` de 7.0 para 6.0
2. Verifique se domínios whitelist estão corretos
3. Ajuste `DEDUP_SIMILARITY_THRESHOLD` de 0.9 para 0.95

### Erro "searchIndex.search is not a function"

**Sintoma**: Dedup stage falha
**Causa**: Bug já corrigido (ver commit)
**Solução**: Certifique-se de usar a versão corrigida em `dedup.ts:31`:
```typescript
await searchIndex().search({ ... })  // ✅ Correto
// NÃO: await searchIndex.search({ ... })  // ❌ Errado
```

### Erro "Citation associatedBullet X out of range"

**Sintoma**: Summarize stage falha
**Causa**: Bug já corrigido (ver commit)
**Solução**: Certifique-se de usar a versão corrigida em `prompts.ts:74`:
```typescript
- IMPORTANT: associatedBullet is ZERO-INDEXED (first bullet = 0, ...)
```

### Telegram "Chat not found"

**Sintoma**: Erro ao enviar mensagem
**Causa**: Bot não é admin do canal ou chat_id incorreto
**Solução**:
1. Certifique-se que o bot foi adicionado ao canal
2. Promova o bot a administrador
3. Verifique `TELEGRAM_CHAT_ID` (deve ter `@` ou `-100...`)

### OpenAI Rate Limit

**Sintoma**: Erro 429 da OpenAI
**Causa**: Muitas chamadas em pouco tempo
**Solução**:
1. Reduza frequência do cron
2. Considere upgrade do tier da OpenAI
3. Sistema já tem retry automático (2 tentativas)

## Endpoints Disponíveis

### POST /api/cron/news-agent

**Descrição**: Executa pipeline completo de notícias
**Auth**: Bearer token (`CRON_SECRET`)
**Timeout**: 15 minutos (Vercel limit)
**Retorno**: JSON com métricas

```bash
curl -X POST https://seu-app.vercel.app/api/cron/news-agent \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

### POST /api/admin/retry-failed

**Descrição**: Reprocessa notícias que falharam no envio
**Auth**: Bearer token (`CRON_SECRET`)
**Uso**: Manual quando há falhas de rede no Telegram

```bash
curl -X POST https://seu-app.vercel.app/api/admin/retry-failed \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

## Custos Estimados

### OpenAI (por execução)

- Discovery: ~$0.05-0.10 (web search + structuring)
- Rerank: ~$0.02
- Summarize: ~$0.03-0.05 (6 notícias)
- **Total**: ~$0.10-0.17 por execução

**Mensal** (4x por dia útil): ~$80-135/mês

### Upstash (Free Tier OK)

- Redis: <1000 comandos/dia → Free
- Search: <1000 queries/dia → Free

### Vercel (Pro necessário)

- $20/mês (crons + function executions)

### Telegram

- Gratuito

**Total estimado**: ~$100-155/mês

## Checklist de Deploy

- [ ] Todos os testes E2E passando localmente
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Bot Telegram configurado como admin do canal
- [ ] Upstash Search index criado (`news-br`)
- [ ] `vercel.json` com configuração de cron
- [ ] Primeira execução manual testada
- [ ] Logs monitorados na primeira execução real
- [ ] Schedule do cron adequado ao uso

## Monitoramento Pós-Deploy

### Primeiras 24h

1. **Acompanhe cada execução** via `vercel logs --follow`
2. **Verifique o canal Telegram** para formato das mensagens
3. **Monitore métricas** no dashboard Vercel
4. **Ajuste schedule** se necessário

### Métricas a observar

- **Execution time**: Deve ficar entre 5-10 min
- **Sent count**: Ideal 4-6 notícias por execução
- **Failed count**: Deve ser 0 (ou <10%)
- **Duplicate count**: Esperado aumentar com o tempo

### Logs estruturados

O sistema usa logs estruturados JSON. Procure por:

```bash
# Sucesso
{"level":"info","message":"agent.run.complete","sentCount":5,...}

# Erros
{"level":"error","message":"stage.send.failed","id":"..."}

# Lock (execução simultânea)
{"level":"warn","message":"agent.lock.exists"}
```

## Próximos Passos (Roadmap)

1. **Dashboard de métricas** (visualizar performance)
2. **Webhook de alertas** (notificar falhas)
3. **ENV vars para hardcoded configs** (modelos, tópicos, domínios)
4. **A/B testing** de diferentes modelos
5. **Cache de web search** (reduzir custos)

## Suporte

Para problemas ou dúvidas:

1. Verifique logs no Vercel
2. Execute testes E2E localmente
3. Revise este guia de deployment
4. Consulte `docs/llm-guide/plan.md` para arquitetura detalhada

---

**Última atualização**: 22 de Outubro de 2025
**Versão**: 0.1.0
**Status**: Production Ready ✅
