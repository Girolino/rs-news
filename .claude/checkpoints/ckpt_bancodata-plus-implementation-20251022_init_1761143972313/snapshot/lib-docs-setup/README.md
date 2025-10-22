# Library Documentation Setup

Scripts simplificados para gerar documentação de bibliotecas para consumo por LLMs/AI.

## 🚀 Quick Start

### 1. Adicionar Nova Biblioteca

```bash
# Usar o helper script
./lib-docs-setup/add-library.sh nome-da-lib

# Ou manualmente
cd lib-docs-setup
npm run add-lib nome-da-lib
```

Isso vai criar:
- `scripts/docs-generator/configs/nome-da-lib.json`
- `docs/libs/nome-da-lib-llm-txt.md`

### 2. Editar Links

Abra `docs/libs/nome-da-lib-llm-txt.md` e adicione os links da documentação:

```markdown
## Section Name
- [Page Title](https://url): Brief description
- [Another Page](https://url): Brief description
```

### 3. Gerar Estrutura

```bash
npm run generate-docs -- --lib=nome-da-lib
```

Isso cria a estrutura de pastas e arquivos .md vazios em `docs/libs/nome-da-lib/`.

### 4. Baixar Conteúdo

```bash
# Testar com poucos docs primeiro
npm run fetch-docs docs/libs/nome-da-lib --batch 5

# Se estiver bom, baixar tudo
npm run fetch-docs docs/libs/nome-da-lib --all

# Ou por seção
npm run fetch-docs docs/libs/nome-da-lib --section nome-secao
```

### 5. Criar Skill (Opcional)

Copie um exemplo de skill e adapte:

```bash
cp -r .claude/skills/zod-docs .claude/skills/nome-da-lib-docs
# Editar .claude/skills/nome-da-lib-docs/SKILL.md
```

## 📚 Bibliotecas Disponíveis

| Biblioteca | Docs | Status | Skill |
|------------|------|--------|-------|
| AI SDK | 271 | ✅ Complete | ✅ |
| TipTap | 296 | ✅ Complete | ✅ |
| tRPC | 25 | ✅ 92% | ✅ |
| Zod | 59 | ✅ 100% | ✅ |
| Convex | 42 | ✅ 93% | ✅ |
| Next.js 16 | 37 | ⚠️ 8% | ✅ |

## 🛠️ Comandos Disponíveis

### Geração
```bash
# Gerar estrutura de docs
npm run generate-docs -- --lib=nome-da-lib
```

### Fetch de Conteúdo
```bash
# Fetch tudo
npm run fetch-docs docs/libs/nome-da-lib --all

# Fetch batch (teste)
npm run fetch-docs docs/libs/nome-da-lib --batch 10

# Fetch seção específica
npm run fetch-docs docs/libs/nome-da-lib --section quickstart

# Fetch arquivo específico
npm run fetch-docs docs/libs/nome-da-lib/quickstart/intro.md
```

### Verificação
```bash
# Ver estrutura gerada
cat docs/libs/nome-da-lib/README.md

# Ver metadata
cat docs/libs/nome-da-lib/_meta.json

# Ver índice de navegação
cat docs/libs/nome-da-lib/_index.md

# Contar docs baixados
grep "fetched: true" docs/libs/nome-da-lib/**/*.md | wc -l
```

## 📝 Estrutura de Arquivos

```
lib-docs-setup/
├── README.md                    ← Este arquivo
├── add-library.sh               ← Script helper para adicionar libs
├── templates/
│   ├── config.template.json     ← Template de configuração
│   ├── links.template.md        ← Template de links
│   └── skill.template.md        ← Template de skill
└── examples/
    ├── zod-config.json          ← Exemplo: Config Zod
    ├── zod-links.md             ← Exemplo: Links Zod
    └── zod-skill.md             ← Exemplo: Skill Zod

scripts/docs-generator/
├── cli.ts                       ← Gerador de estrutura
└── configs/
    ├── ai-sdk.json
    ├── tiptap.json
    ├── trpc.json
    ├── nextjs.json
    ├── convex.json
    └── zod.json

scripts/
└── fetch-docs-content.ts        ← Fetcher genérico otimizado

docs/libs/
├── README.md                    ← Overview de todas as libs
├── SETUP-GUIDE.md              ← Guia detalhado
├── ai-sdk-llm-txt.md
├── ai-sdk/                      ← 271 docs
├── tiptap-llm-txt.md
├── tiptap/                      ← 296 docs
├── trpc-llm-txt.md
├── trpc/                        ← 25 docs
├── zod-llm-txt.md
├── zod/                         ← 59 docs
├── convex-llm-txt.md
├── convex/                      ← 42 docs
├── nextjs-llm-txt.md
└── nextjs/                      ← 37 docs

.claude/skills/
├── ai-sdk-docs/SKILL.md
├── tiptap-docs/SKILL.md
├── trpc-docs/SKILL.md
├── nextjs-docs/SKILL.md
├── convex-docs/SKILL.md
└── zod-docs/SKILL.md
```

## ⚡ Características do Fetcher

- **Concorrência**: 5 requests paralelos
- **Velocidade**: 200ms delay entre batches (5x mais rápido)
- **Genérico**: Funciona com qualquer site
- **Retry**: 3 tentativas com delay progressivo
- **Timeout**: 30s por request
- **Smart Parsing**: Múltiplos seletores CSS
- **Clean Markdown**: Remove navegação, headers, footers

## 🎯 Boas Práticas

1. **Sempre teste com batch pequeno primeiro**
   ```bash
   npm run fetch-docs docs/libs/nova-lib --batch 3
   ```

2. **Verifique a qualidade dos primeiros docs**
   ```bash
   cat docs/libs/nova-lib/[primeiro-doc].md
   ```

3. **Se a qualidade estiver ruim, ajuste os seletores no config**
   ```json
   {
     "parser": {
       "contentSelectors": ["main", ".custom-content"],
       "removeSelectors": [".sidebar", ".ads"]
     }
   }
   ```

4. **Para sites client-side rendered, considere:**
   - Usar Puppeteer/Playwright (mais lento mas funciona)
   - Buscar API endpoints diretos
   - Usar fetch manual seletivo

## 🔧 Troubleshooting

### Problema: "No main content found"

**Solução**: Ajustar seletores no config da biblioteca:
```json
{
  "parser": {
    "contentSelectors": [
      "main",
      "article",
      ".docs-content",
      ".your-custom-selector"
    ]
  }
}
```

### Problema: Conteúdo com muito lixo

**Solução**: Adicionar mais seletores de remoção:
```json
{
  "parser": {
    "removeSelectors": [
      "nav",
      "footer",
      ".ads",
      ".newsletter",
      ".your-custom-junk"
    ]
  }
}
```

### Problema: Fetch muito lento

**Solução**: Já está otimizado com concorrência. Se precisar mais:
1. Editar `CONCURRENCY` em `scripts/fetch-docs-content.ts`
2. Reduzir `DELAY_MS` (mas respeite rate limits)

### Problema: Site bloqueia requests

**Solução**:
1. Aumentar delay: `DELAY_MS = 500` ou mais
2. Adicionar User-Agent no curl
3. Usar Puppeteer para simular browser

## 📦 Dependências

Já instaladas no projeto:
- `gray-matter` - Parse frontmatter
- `cheerio` - DOM parsing
- `turndown` - HTML → Markdown
- `tsx` - TypeScript execution

## 🚀 Performance

| Biblioteca | Docs | Tempo (5x concorrência) |
|------------|------|-------------------------|
| Zod (59) | 100% | ~2 minutos |
| Convex (42) | 93% | ~1.5 minutos |
| tRPC (25) | 92% | ~1 minuto |
| AI SDK (271) | 100% | ~8 minutos |
| TipTap (296) | 100% | ~9 minutos |

## 💡 Dicas

- **Use skills mesmo com docs incompletos**: As skills podem buscar online quando local falha
- **Priorize bibliotecas que você usa mais**: Zod, tRPC, Convex são rápidos
- **Sites React/Vue/Angular**: Geralmente precisam Puppeteer
- **Atualize periodicamente**: Re-run fetch para docs atualizados
- **Cache é permanente**: Docs fetchados nunca precisam re-fetch (a menos que você queira)

## 📖 Próximos Passos

1. ✅ Adicionar biblioteca
2. ✅ Gerar estrutura
3. ✅ Fetch conteúdo
4. ✅ Criar skill
5. ✅ Testar com Claude Code
6. ✅ Compartilhar com time

## 🆘 Suporte

- **Guia Detalhado**: `docs/libs/SETUP-GUIDE.md`
- **Overview**: `docs/libs/README.md`
- **Examples**: `lib-docs-setup/examples/`
- **Generator README**: `scripts/docs-generator/README.md`

---

**Status**: 6 bibliotecas prontas, ~700 docs disponíveis para LLMs! 🎉
