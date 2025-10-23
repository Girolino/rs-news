# Guia de Contrato de Saída (StructuredNewsItem)

Este documento define o contrato de dados que o estágio de sumarização deve obedecer ao produzir um `StructuredNewsItem`. As regras abaixo são mandatórias para todo modelo ou agente utilizado no pipeline.

## Campos obrigatórios

- `finalTitle`: string, ≤ 80 caracteres, tom informativo e objetivo.
- `summary`: string, ≤ 200 caracteres, foco no impacto ou decisão.
- `bullets`: lista com 2–3 itens, cada um ≤ 180 caracteres e amarrado a uma citação (`associatedBullet` zero-indexado).
- `citations`: cada registro deve ter `url`, `title`, `quote`, `associatedBullet`.
- `summaryForSearch`: versão condensada para indexação.
- `topic`: ver enum abaixo.
- `tags`: lista (0–3) de tickers em maiúsculo. Quando não houver, retornar `[]`.

Os campos herdados da etapa de rerank (`companies`, `categories`, `impact`, `relevanceScore`, etc.) permanecem inalterados.

## Enum `topic`

O campo `topic` restringe o assunto principal da nota. Valores válidos:

- `economia`: indicadores macro, política monetária, fiscal, inflação, PIB.
- `politica`: decisões governamentais, Legislativo/Judiciário com impacto econômico direto.
- `empresas`: fatos relevantes, resultados, M&A, governança corporativa.
- `mercados`: bolsa, juros, câmbio, commodities, ratings, fluxo de capital.
- `tecnologia`: inovação, regulatório tech, startups com efeito sobre mercado.

Heurística: escolha o assunto dominante para o investidor. Se empatar, priorize o mais específico (`empresas` sobre `economia`, por exemplo).

## Campo `tags`

`tags` serve como chave para correlacionar notícias a ativos negociados.

Regras:

1. Apenas tickers alfanuméricos em maiúsculo (regex `^[A-Z0-9]{1,7}(\.[A-Z0-9]{1,3})?$`).
2. Nada de prefixo `#` ou texto livre.
3. Prefira ticker local (ex.: `PETR4`) e inclua sufixo da bolsa quando necessário (`ITUB4.SA`, `AAPL`).
4. No máximo 3 tickers, ordenados por relevância.
5. Se não houver ativo claro, retorne array vazio. O formatter exibirá `N/D`.

A etapa de sumarização normaliza cada tag removendo espaços, `#`, caracteres especiais e forçando maiúsculas; entradas inválidas são descartadas.

## Exemplo de payload válido

```json
{
  "finalTitle": "Copom mantém Selic em 10,50% e sinaliza cautela",
  "summary": "BC interrompe cortes e destaca incerteza fiscal.",
  "bullets": [
    "Decisão foi unânime após avaliação de cenários externos.",
    "Diretoria reforça dependência de dados para próximos passos.",
    "Projeção de inflação 2025 permanece em 3,4%."
  ],
  "citations": [
    {
      "url": "https://www.bcb.gov.br/copom/ata",
      "title": "Banco Central",
      "quote": "O Comitê decidiu, por unanimidade, manter a taxa Selic em 10,50% a.a.",
      "associatedBullet": 0
    },
    {
      "url": "https://www.bcb.gov.br/copom/comunicado",
      "title": "Banco Central",
      "quote": "O Comitê avaliará se a interrupção é mantida em reuniões futuras.",
      "associatedBullet": 1
    },
    {
      "url": "https://www.bcb.gov.br/copom/comunicado",
      "title": "Banco Central",
      "quote": "As projeções do Comitê situam-se em 3,4% para 2025.",
      "associatedBullet": 2
    }
  ],
  "topic": "economia",
  "tags": [],
  "summaryForSearch": "Copom mantém Selic em 10,50% e indica postura dependente de dados."
}
```

## Boas práticas de anotação

- O `topic` deve refletir a narrativa do título e do resumo. Ajuste-o se o modelo escolher algo genérico demais.
- Use `tags` apenas quando o texto mencionar explicitamente a empresa ou o ativo. Mencionar “setor elétrico” sem citar tickers não é suficiente.
- Fatos referentes a múltiplas classes da mesma companhia podem listar ambos (`PETR3`, `PETR4`), desde que o texto sustente.
- Para companhias estrangeiras com ADR na B3, preferir o ticker negociado localmente; quando inexistente, usar o ticker da bolsa primária (ex.: `AAPL`).

## Validação

O `StructuredNewsItem` passa por `zod` com as regras acima. Entradas que não respeitarem o contrato causarão falha na etapa de sumarização. Valide manualmente mudanças no prompt sempre que alterar a lógica de topic/tags.

