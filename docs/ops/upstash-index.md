# Auditoria do Upstash Search — novembro/2025

## Estado Atual
- Índice: `news-br`
- Cliente: `@upstash/search` (`Search.index`)
- Campos persistidos hoje:
  - `content.text` → `summaryForSearch`
  - Metadados: `title`, `url`, `companies`, `topic`, `tags`, `timestamp`, `score`, `telegramMessageId`
- Idioma/analyzer: padrão (inglês) — **ação necessária:** migrar para PT-BR.

## Ações Planejadas
1. **Migrar analyzer**: recriar índice com suporte PT-BR (`language: "portuguese"`), preservando dados via reindex.
2. **Adicionar fingerprint lexical**: armazenar `bodyFingerprint` (hex SimHash 64-bit) e `normalizedTitle`.
3. **Versionamento**: incluir campo `schemaVersion` nos metadados para futuras migrações.

## Próximos Passos
- Script de migração `scripts/upstash-reindex.ts` (a ser criado) para export/import.
- Após migração, atualizar `docs/ops/dedup-experiments.md` com resultados de busca.
- Validar via `searchIndex().search` que documentos novos retornam com `bodyFingerprint`.
