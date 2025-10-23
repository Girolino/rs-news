Abaixo vai minha avaliação crítica do seu plano e, em seguida, o plano completo reescrito com melhorias — especialmente no agentic flow e no uso do Vercel AI‑Gateway. Mantive PT‑BR, evitei Sentry conforme solicitado e respeitei as demais premissas (sem RSS/API de notícias dedicada e sem Postgres).

Avaliação crítica (curta e objetiva)

Acertos

Arquitetura enxuta: Next.js + Vercel Cron + Upstash (Redis/Vector) + Telegram.

Deduplicação semântica no Upstash Vector.

Estruturação com Zod e formatação final para Telegram.

Métricas e logging estruturado.

Oportunidades de melhoria

Busca/Fontes — “web search nativa do LLM” não é garantia de cobertura/qualidade. Precisamos de uma tool determinística para search/fetch (ex.: Tavily/Bing SerpAPI/Google Programmable Search) ou um crawler de whitelist (BCB, CVM, B3, RI das companhias, etc.). O LLM não deve “inventar” citações.

Agentic flow — Criar um pipeline multiestágios com papéis claros: Planner → Coletor → Validador de fontes → Agrupador/Cluster → Ranker → Redator → Checador factual → Editor de estilo. Adicionar cheque temporal (timestamp e TZ Brasil) e verificação cruzada de claims.

Citações — Extraí-las de forma determinística (da camada de coleta), e só então passar ao LLM para redação, nunca o inverso.

Deduplicação — Complementar o vetor com uma fingerprint lexical (MinHash/SimHash) para reduzir falsos positivos/negativos; parametrização por janela temporal.

Embeddings — Corrigir dimensão: text-embedding-3-small é 1536 dimensões (não 768). Prever reindex caso troque o modelo.

AI-Gateway — Centralizar routing/fallback/observabilidade no Vercel AI‑Gateway e definir política de modelo por tarefa (ex.: modelos leves para classificação, frontier para redação/checagem).

Confiabilidade — Lock de concorrência via Redis (SETNX + TTL) para garantir 1 execução/hora; idempotency key por notícia; dead‑letter para falhas de envio.

Segurança — Mesmo sem usuário, há risco de injection via páginas web. Sanitizar HTML, limitar tools a domínios allowlist, ignorar instruções embutidas no conteúdo coletado.

Cron vs QStash — Para 1 job/hora <30s, Vercel Cron basta. QStash vira útil para fan‑out, retry robusto, delay queues e “replay” — deixar como opcional/etapa futura.

Formatação Telegram — Usar parse_mode=HTML para reduzir problemas de escape; inline keyboard para “Fontes / Ver similares”; disable_web_page_preview configurável.

Plano de Implementação (revisado e passo a passo)
1) Visão e Requisitos

Objetivo: feed horário (ou configurável) de notícias de economia e mercado Brasil (PT‑BR), com alta precisão, citações confiáveis e baixo ruído.

Canais: Telegram (canal privado inicialmente).

Sem Postgres/Sentry/RSS/API de notícias proprietária.

TZ e datas: usar America/Sao_Paulo. Todas as datas apresentadas ao usuário final devem ser normalizadas.

2) Princípios de Projeto

Retrieve‑then‑generate: primeiro coletar e validar fontes; depois o LLM resume/redige.

Determinismo nas citações: o LLM nunca inventa links; apenas recebe contexto com URLs verificadas.

Agentic flow multiestágios com guardrails (ver §5).

Idempotência e locks para evitar duplicidade de envios.

Observabilidade sem Sentry: structured logs + métricas no próprio Redis/Log Drains da Vercel.

3) Stack Tecnológica

Framework: Next.js (App Router) + TypeScript.

AI Orquestração: Vercel AI SDK (tools/structured output/stream) via Vercel AI‑Gateway (agnóstico e com fallback/metrics).

LLMs (via Gateway; política por tarefa):

Classificação/extração/score: modelo cost‑effective (ex.: GPT‑4o‑mini/Claude Haiku/LLama 3.x 8B via provedor compatível).

Redação/checagem: modelo frontier (ex.: GPT‑4o/Claude Sonnet).

Embeddings: text-embedding-3-small (1536 dims).

Busca e Coleta:

Opção A (recomendada): API de busca (Tavily/Serper/Bing) como tool do agente.

Opção B (sem buscador): crawler leve com allowlist (BCB, CVM, B3, Tesouro, ANEEL/ANP/ANATEL, RI das companhias, Agência Brasil, etc.). Scrapers simples (HTML → texto) e rate limit.

Você pode começar com A e adicionar B para fontes regulatórias (baixa fricção).

Storage: Upstash Redis (KV/JSON, locks, idempotência) + Upstash Vector (HNSW).

Mensageria: Telegram Bot API.

Deploy/Jobs: Vercel + Vercel Cron (início) — QStash opcional.

Schema/validação: Zod.

4) Dados e Estruturas
Redis (KV/JSON)

sent_news:{newsId} → payload completo (permanente).

sent_news_ids (SET) → todos IDs enviados (permanente).

search_cache:{queryHash} → cache de SERP/fetch (TTL 7d).

run_lock → lock de execução (SETNX + TTL 15min).

idempotency:{fingerprint} → de‑dup de envio curto prazo (TTL 48h).

last_run_metadata → resumo da última execução.

dead_letter:{timestamp} → lotes que falharam no envio.

Vector (Upstash Vector)

Dimensão: 1536 (embedding text-embedding-3-small).

Metadata: title, summary, url, domain, companies[], categories[], timestamp, relevanceScore, telegramMessageId, fingerprint.

Índice: cosine. topK=5.

Fingerprint (lexical)

SimHash/MinHash da headline + lead + url normalizada para de‑dup rápido.

Armazenar junto do registro em Redis e como metadado no Vector.

5) Agentic Flow (fases e responsabilidades)

Planner

Gera consultas por tema (macro, política monetária, corporativo B3, setorial, ratings, operações estruturadas, regulatório).

Prioriza domínios allowlist e aplica filtros temporais (≤ 2–3h).

Saída: lista de queries + targets (domínios/URLs) + pesos.

Coletor (Search & Fetch Tool)

Executa search API (ou crawler allowlist).

Normaliza URLs, resolve redirecionamentos, extrai timestamp do artigo (ou heurística).

Faz fetch do HTML e converte para texto limpo (strip scripts/iframes).

Nunca passa HTML bruto ao LLM.

Validador de Fontes

Verifica domínio contra allowlist; avalia autoridade da fonte.

Rejeita itens sem URL canônica ou com timestamp inválido/antigo.

Mantém apenas itens com content length mínimo.

Agrupador/Clustering (story‑level)

Cluster semântico (Vector) + fingerprint lexical para unir duplicatas cross‑fonte.

Seleciona 1 representante por cluster (maior autoridade + mais atual).

Extração/Normalização

LLM leve para extrair: title, lead, entidades (empresas/tickers), tipo de evento (guideline, M&A, rating, RI, CVM, macro), categorias.

Resolve empresas → tickers B3 via dicionário em Redis (sinônimos, nomes curtos e razão social). Fallback semântico p/ casos ambíguos.

Scoring e Ranking

Score final = f(autoridade da fonte, frescor, impacto (tipo de evento), presença de empresas listadas, novidade vs histórico, volume de cobertura cross‑fonte).

Limite mínimo (ex.: ≥7/10) e top‑N por execução (ex.: 3–8 itens).

Redação (Draft)

Modelo frontier recebe apenas o texto limpo + metadados + URLs do item vencedor do cluster.

Pede resumo objetivo PT‑BR, título claro e 3–5 bullets de impacto (sem opinião, sem adjetivos excessivos), com timezone BR.

Checagem Factual Cruzada

LLM revalida cada bullet contra o conteúdo bruto e lista de URLs do cluster. Qualquer claim sem ancoragem → reescrever/omitir.

Adiciona carimbo de data/hora (BRT/BRST) na saída.

Editor de Estilo / Formatação Telegram

Gera mensagem em HTML com: título, bullets, assunto (enum fixo), tags (tickers), timestamp, [Fontes] (1–3 links).

Inline keyboard: [Fontes], [Similares] (link para página interna opcional).

Envio

sendMessage com parse_mode=HTML.

disable_web_page_preview: configurável por categoria (ex.: ligar para notas de RI).

Retry exponencial (até 5).

Persistência

Redis: objeto completo + messageId.

Vector: upsert de embedding + metadados.

Registrar fingerprint em idempotency:*.

Telemetria & Métricas

Contagens: buscadas/validadas/clusterizadas/enviadas/ignoradas.

Custos (AI‑Gateway), latência por fase, taxa de duplicatas, precisão estimada (auditoria manual).

6) Cron vs QStash

Fase 1 (recomendada): Vercel Cron (ex.: 0 * * * *). Coloque lock Redis (SETNX) para impedir concorrência e use idempotency key por batch.

Quando adotar QStash:

Precisa de retries automáticos fora da janela do Cron.

Fan‑out de tarefas (ex.: enviar para múltiplos canais/grupos em paralelo).

Delay queues e dead‑letter gerenciado.

Conclusão: comece com Vercel Cron; QStash entra como evolução.

7) Segurança e Conformidade

Allowlist estrita de domínios (ex.: BCB, CVM, B3, Tesouro, RI de companhias, Agência Brasil, Valor*, InfoMoney, Estadão Economia, Folha Mercado, O Globo Economia, Brazil Journal, agências de rating). (*Note: lidar com paywalls; quando houver, use título/lead público e a fonte oficial de RI/regulador como verificação.)

Sanitização: remover scripts/estilos/links de rastreamento; aceitar apenas <b><i><u><a><br><code> no HTML final.

Anti‑injection: o tooling nunca executa instruções do conteúdo coletado; prompts não incorporam “instruções” vindas da web.

Disclaimer: inserir nota padrão “Conteúdo informativo; não constitui recomendação de investimento.”

8) Formato da Mensagem (Telegram)

Título (negrito via <b>), timestamp (BRT/BRST).

3–5 bullets objetivos (cada um uma evidência).

Assunto: enum {Economia, Política, Empresas, Mercados, Tecnologia}.

Tags: até 3 tickers em maiúsculo (ex.: PETR4, VALE3, AAPL). Quando não houver, usar “N/D”.

Fontes: até 3, com nomes de domínio (ex.: [CVM], [RI Petrobras], [B3]).

Ex.:

<b>Petrobras revisa capex 2025–2029</b> — 22 out 2025, 10:07 BRT
• Investimento projetado sobe X% versus plano anterior, focando no pré-sal.
• Guidance de produção permanece estável; cronograma de desinvestimentos é ajustado.
• Conselho mantém política de dividendos condicionada ao limite de alavancagem.
📌 Assunto: Empresas
🏷️ Tags: PETR4, PETR3
Fontes: [RI Petrobras](https://...), [CVM](https://...)

9) Métricas de Qualidade

Precisão factual (amostragem manual semanal).

Cobertura (nº de histórias únicas/hora).

Duplicação (<3% de dups em 7 dias).

Latência (<30s por ciclo p95).

Custo (orçado por fase; routing no Gateway para otimizar).

Engajamento (visualizações/click‑through em “Fontes”).

10) Estrutura de Arquivos (revisada)
telegram-news-agent/
├─ src/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ cron/news-agent/route.ts       # Endpoint do Vercel Cron (+ lock)
│  │  │  └─ trpc/[trpc]/route.ts           # Handler tRPC (se mantiver)
│  │  ├─ page.tsx                           # Dashboard opcional (histórico/metrics)
│  │  └─ layout.tsx
│  ├─ server/
│  │  ├─ agent/
│  │  │  ├─ planner.ts
│  │  │  ├─ collector.ts                    # search + fetch + parse (tools)
│  │  │  ├─ validator.ts                    # allowlist, timestamps, autoridade
│  │  │  ├─ cluster.ts                      # vector + fingerprint
│  │  │  ├─ extract.ts                      # entidades/tickers/categorias
│  │  │  ├─ rank.ts                         # scoring final
│  │  │  ├─ write.ts                        # redação + checagem factual
│  │  │  └─ format.ts                       # HTML Telegram
│  │  ├─ services/
│  │  │  ├─ ai/
│  │  │  │  ├─ gateway.ts                   # cliente Vercel AI-Gateway
│  │  │  │  ├─ llm.ts                       # policies de modelo por tarefa
│  │  │  │  └─ embeddings.ts                # wrapper embed(1536)
│  │  │  ├─ search/
│  │  │  │  ├─ serp.ts                      # Tavily/Serper/Bing (opção A)
│  │  │  │  └─ whitelist.ts                 # crawlers oficiais (opção B)
│  │  │  ├─ storage/
│  │  │  │  ├─ redis.ts                     # KV/JSON + locks + idempotência
│  │  │  │  └─ vector.ts                    # Upstash Vector
│  │  │  └─ telegram/bot.ts                 # wrapper Telegram
│  │  └─ lib/
│  │     ├─ fingerprints.ts                 # SimHash/MinHash
│  │     ├─ time.ts                         # TZ BR, normalização de datas
│  │     ├─ logger.ts                       # structured logging
│  │     └─ types.ts                        # Zod schemas
│  └─ lib/
│     └─ utils.ts
├─ .env.example
├─ next.config.js
├─ tsconfig.json
├─ package.json
└─ vercel.json                              # Cron

11) Fluxo de Execução (detalhado)

Cron hit → /api/cron/news-agent valida Authorization.

Lock run_lock (SETNX). Se falhar, 409 e encerra.

Planner gera queries.

Collector chama search tool (cache SERP em Redis), faz fetch dos top‑links, parse.

Validator aplica allowlist, excluir antigos, medir content length.

Cluster usa Vector (topK=5) + fingerprint. Escolhe representante por cluster.

Extract (LLM leve) entidades, categorias, tipo de evento.

Rank calcula relevanceScore; filtra por limiar (≥7).

Write (LLM frontier) redige resumo + bullets; Check revalida cada bullet contra o contexto bruto e URLs.

Format converte para HTML com assunto/tags/fontes.

Idempotency: checa idempotency:fingerprint. Se novo, envia Telegram; se já visto nas últimas 48h, descarta.

Persist no Redis e Vector; salva messageId.

Release lock; loga métricas.

12) Variáveis de Ambiente
# AI Gateway
AI_GATEWAY_URL=
AI_GATEWAY_API_KEY=
AI_MODEL_SUMMARIZE=      # p.ex. openai:gpt-4o
AI_MODEL_CLASSIFY=       # p.ex. openai:gpt-4o-mini
AI_MODEL_EMBEDDING=openai:text-embedding-3-small

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Upstash Vector
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=

# Search API (opção A)
SEARCH_API_KEY=          # Tavily/Serper/Bing
SEARCH_API_ENDPOINT=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Security
CRON_SECRET=

# Misc
TZ=America/Sao_Paulo
NODE_ENV=production

13) Ordem de Implementação (replanejada)

Sprint 1 – Fundações

Next.js + TS + vercel.json (Cron) + endpoint protegido.

Redis/Vector clientes + locks/idempotência.

AI‑Gateway client + policies por tarefa.

Zod schemas.

Sprint 2 – Coleta confiável
5. Search tool (A) + cache; fetch + parse HTML (sanitize).
6. Allowlist e validação temporal/autoridade.
7. Fingerprint (SimHash) + embeddings; cluster.

Sprint 3 – IA & Relevância
8. Extração entidades/categorias (LLM leve).
9. Scoring/ranking; parametrização do limiar.
10. Redação + checagem factual (LLM frontier).

Sprint 4 – Saída e Persistência
11. Formatação HTML Telegram + inline keyboard.
12. Envio com retry; persistência Redis/Vector.
13. Métricas e structured logs (latência/custo/dups).

Sprint 5 – Qualidade & Hardening
14. Testes de regressão (conjunto rotulado de notícias).
15. Alarmes básicos (falhas de envio e ausência de resultados).
16. (Opcional) QStash para dead‑letter/fan‑out.

14) Parâmetros recomendados

Vector: topK=5, threshold semântico ~0.86; janela de clusterização: 24h.

Fingerprint: Hamming distance ≤3 como duplicata.

Limiar de rank: iniciar em 7/10; ajustar conforme precision/recall.

Corte por frescor: ≤ 3h (macro) / ≤ 6h (corporate noturno).

Batch/hora: 3–8 histórias, priorizando macro/regulatório e company‑specific de alta materialidade.

15) Observabilidade (sem Sentry)

Logs: por fase (coleta, validação, cluster, redação, envio), com traceId.

Métricas: armazenar no Redis (last_run_metadata) + opcional Log Drain da Vercel para Axiom/Datadog.

Alertas: se enviadas=0 por 3 ciclos seguidos ou falhas_envio>0 p95 → webhook de alerta (ou mensagem para canal interno no Telegram).

16) Riscos e Mitigações

Paywalls: priorizar fontes oficiais/regulatórias e leads públicos. Quando só houver manchete, rotular explicitamente (“conteúdo parcial”).

Hallucination: bloqueado pelo retrieve‑then‑generate + checagem factual cruzada.

Timezone/horário de verão: centralizar em time.ts (IANA TZ) e imprimir sempre timestamp com “BRT/BRST”.

Troca de modelo/embedding: versionar embedding_model no metadado; reindexar incrementalmente.

Conclusão

Sim, dá para melhorar o agentic flow: o plano revisado introduz pipeline multiestágios com checagem factual e governança de fontes.

Sim, usar o Vercel AI‑Gateway traz agnosticidade, métricas e fallback/routing por tarefa.

QStash: não é necessário no MVP. Adote quando precisar de retries desacoplados, fan‑out e DLQ.

Correções-chave: embeddings 1536 dims; citações determinísticas; allowlist; locks; fingerprint adicional na deduplicação; formatação HTML no Telegram.

Se quiser, na próxima resposta já lhe entrego os Zod schemas e a assinatura das funções principais (planner, collector, cluster, rank, write/check, format, send) prontos para colar no projeto.
