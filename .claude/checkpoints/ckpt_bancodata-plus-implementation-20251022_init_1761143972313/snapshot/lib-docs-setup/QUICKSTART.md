# Quick Start - Adicionar Nova Biblioteca

## 🚀 Em 5 Minutos

### 1. Executar Script Helper
```bash
./lib-docs-setup/add-library.sh react-query
```

### 2. Editar Links
```bash
vim docs/libs/react-query-llm-txt.md
```

Adicione os links da documentação oficial:
```markdown
## Getting Started
- [Introduction](https://tanstack.com/query/latest/docs): O que é React Query
- [Installation](https://tanstack.com/query/latest/docs/installation): Como instalar
```

### 3. Atualizar Config (Opcional)
```bash
vim scripts/docs-generator/configs/react-query.json
```

Atualize URLs corretas:
```json
{
  "homepage": "https://tanstack.com/query",
  "docsUrl": "https://tanstack.com/query/latest/docs"
}
```

### 4. Gerar Estrutura
```bash
npm run generate-docs -- --lib=react-query
```

### 5. Testar Fetch
```bash
npx tsx scripts/fetch-docs-content.ts docs/libs/react-query --batch 3
```

### 6. Se Estiver Bom, Buscar Tudo
```bash
npx tsx scripts/fetch-docs-content.ts docs/libs/react-query --all
```

### 7. Criar Skill (Opcional)
```bash
mkdir -p .claude/skills/react-query-docs
cp lib-docs-setup/templates/skill.template.md .claude/skills/react-query-docs/SKILL.md

# Editar e adaptar
vim .claude/skills/react-query-docs/SKILL.md
```

## ✅ Pronto!

Agora você pode usar a skill no Claude Code:

```
User: "Como usar React Query para fetch de dados?"
Claude: [Carrega react-query-docs skill e responde com base na documentação local]
```

## 📊 Verificar Resultado

```bash
# Ver estrutura
cat docs/libs/react-query/README.md

# Ver docs baixados
grep "fetched: true" docs/libs/react-query/**/*.md | wc -l

# Ver índice
cat docs/libs/react-query/_index.md
```

## 💡 Dicas

- Sempre teste com `--batch 3` primeiro
- Verifique a qualidade dos primeiros docs
- Se houver falhas, ajuste os seletores no config
- Para sites React/Vue, considere usar Puppeteer

---

Para mais detalhes, veja [README.md](./README.md)
