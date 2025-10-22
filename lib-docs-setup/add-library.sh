#!/bin/bash
# Script helper para adicionar nova biblioteca

set -e

if [ -z "$1" ]; then
  echo "❌ Erro: Nome da biblioteca é obrigatório"
  echo ""
  echo "Uso: ./add-library.sh nome-da-lib"
  echo ""
  echo "Exemplo: ./add-library.sh react-query"
  exit 1
fi

LIB_ID="$1"
LIB_NAME="${1//-/ }"  # Converte hífens em espaços
LIB_DISPLAY_NAME="$(echo $LIB_NAME | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1')"  # Title case

echo "🚀 Criando biblioteca: $LIB_DISPLAY_NAME"
echo ""

# 1. Criar config
CONFIG_FILE="scripts/docs-generator/configs/${LIB_ID}.json"
if [ -f "$CONFIG_FILE" ]; then
  echo "⚠️  Config já existe: $CONFIG_FILE"
else
  echo "📝 Criando config: $CONFIG_FILE"
  cat > "$CONFIG_FILE" << EOF
{
  "id": "${LIB_ID}",
  "name": "${LIB_ID}",
  "displayName": "${LIB_DISPLAY_NAME}",
  "homepage": "https://exemplo.com",
  "docsUrl": "https://exemplo.com/docs",
  "source": {
    "type": "manual",
    "manualLinksFile": "docs/libs/${LIB_ID}-llm-txt.md"
  },
  "parser": {
    "contentSelectors": [
      "main",
      "article",
      "[role='main']",
      ".docs-content",
      ".markdown-body"
    ],
    "removeSelectors": [
      "script",
      "style",
      "nav",
      "header",
      "footer",
      ".sidebar",
      ".breadcrumb",
      ".navigation"
    ]
  },
  "structure": {
    "outputDir": "docs/libs/${LIB_ID}",
    "organizationStrategy": "by-url-path"
  },
  "skill": {
    "enabled": true,
    "skillId": "${LIB_ID}-docs",
    "description": "Query ${LIB_DISPLAY_NAME} documentation",
    "sections": [
      {
        "name": "getting-started",
        "description": "Getting started guide",
        "exampleQuery": "How do I get started with ${LIB_DISPLAY_NAME}?"
      }
    ]
  },
  "fetch": {
    "delayMs": 1000,
    "maxRetries": 3,
    "retryDelayMs": 2000
  }
}
EOF
  echo "✅ Config criado"
fi

# 2. Criar links template
LINKS_FILE="docs/libs/${LIB_ID}-llm-txt.md"
if [ -f "$LINKS_FILE" ]; then
  echo "⚠️  Links file já existe: $LINKS_FILE"
else
  echo "📝 Criando links template: $LINKS_FILE"
  cat > "$LINKS_FILE" << EOF
# ${LIB_DISPLAY_NAME} Documentation Links

## Getting Started
- [Introduction](https://exemplo.com/docs): O que é ${LIB_DISPLAY_NAME}
- [Installation](https://exemplo.com/docs/installation): Como instalar

## Core Concepts
- [Concept 1](https://exemplo.com/docs/concept-1): Descrição do conceito 1
- [Concept 2](https://exemplo.com/docs/concept-2): Descrição do conceito 2

## API Reference
- [API Overview](https://exemplo.com/docs/api): Overview da API
- [Functions](https://exemplo.com/docs/api/functions): Funções disponíveis

## TODO: Adicione mais links visitando a documentação oficial
## Visite https://exemplo.com/docs e adicione os links relevantes
EOF
  echo "✅ Links template criado"
fi

echo ""
echo "✅ Biblioteca adicionada com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Edite os links:"
echo "   vim $LINKS_FILE"
echo ""
echo "2. Atualize o config com URLs corretas:"
echo "   vim $CONFIG_FILE"
echo ""
echo "3. Gere a estrutura:"
echo "   npm run generate-docs -- --lib=${LIB_ID}"
echo ""
echo "4. Teste o fetch:"
echo "   npm run fetch-docs docs/libs/${LIB_ID} --batch 3"
echo ""
echo "5. Se estiver bom, busque tudo:"
echo "   npm run fetch-docs docs/libs/${LIB_ID} --all"
echo ""
