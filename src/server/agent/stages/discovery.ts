import { Output, generateText, hasToolCall, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getModelName } from "@/server/services/ai/models";
import {
  type DiscoveryNewsItem,
  discoveryNewsItemSchema,
} from "@/types/news";
import { logger } from "@/server/lib/logger";

const discoveryResultSchema = z.object({
  news: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      title: z.string(),
      timestamp: z.string(),
      body_text_clean: z.string(),
      source: z.string().optional(),
    }),
  ),
});

const QUERIES = [
  "Selic BCB decisão",
  "IPCA inflação Brasil",
  "PIB IBGE",
  "empresas B3 fato relevante",
  "dividendos extraordinários Brasil",
  "fusões aquisições Brasil",
  "Ibovespa fechamento",
  "Petrobras resultado trimestral",
];

const DOMAIN_WHITELIST = [
  "valor.globo.com",
  "infomoney.com.br",
  "estadao.com.br",
  "ri.b3.com.br",
  "investidor10.com.br",
  "moneytimes.com.br",
];

export async function runDiscoveryStage(): Promise<DiscoveryNewsItem[]> {
  logger.info("stage.discovery.start", {
    queries: QUERIES.length,
    whitelist: DOMAIN_WHITELIST.length,
  });

  const result = await generateText({
    model: getModelName("DISCOVERY"),
    system:
      [
        "Você é um agente financeiro brasileiro especializado em encontrar notícias recentes e relevantes sobre macroeconomia e empresas listadas na B3.",
        "Trabalhe em múltiplos passos: avalie as consultas sugeridas, selecione apenas domínios aprovados e produza um resumo estruturado chamando a ferramenta finalizeDiscovery ao concluir.",
        "Obedeça rigorosamente a whitelist de domínios:",
        DOMAIN_WHITELIST.map((domain) => `- ${domain}`).join("\n"),
        "Critérios obrigatórios:",
        "- Priorize itens publicados nas últimas 12 horas.",
        "- Garanta que cada notícia tenha corpo textual suficiente (>= 100 caracteres).",
        "- Use títulos profissionais em português e não invente URLs.",
        "- Inclua `source` com o domínio original.",
      ].join("\n"),
    prompt: [
      "Siga as etapas:",
      "1. Liste mentalmente (sem emitir resposta) possíveis consultas usando as sugestões abaixo e combine termos conforme necessário.",
      QUERIES.map((query) => `   - ${query}`).join("\n"),
      "2. Considere se precisa de novas consultas; você pode propor até 3 consultas adicionais chamando a ferramenta proposeQuery.",
      "3. Quando estiver pronto, chame finalizeDiscovery com até 15 notícias distintas respeitando a whitelist.",
    ].join("\n"),
    stopWhen: [hasToolCall("finalizeDiscovery"), stepCountIs(6)],
    tools: {
      proposeQuery: tool({
        description:
          "Propor uma nova consulta de busca caso precise de mais resultados.",
        inputSchema: z.object({
          query: z.string().min(3, "query deve conter ao menos 3 caracteres"),
          rationale: z
            .string()
            .min(5, "explique brevemente por que a consulta é necessária"),
        }),
        execute: async ({ query, rationale }) => {
          logger.debug("stage.discovery.proposed_query", { query, rationale });
          return {
            accepted: true,
            note: "Consulta registrada para raciocínio interno.",
          };
        },
      }),
      finalizeDiscovery: tool({
        description:
          "Finalize o processo retornando as notícias estruturadas de acordo com o schema.",
        inputSchema: discoveryResultSchema,
        execute: async (payload) => payload,
      }),
    },
    experimental_output: Output.object({
      schema: discoveryResultSchema,
    }),
  });

  const structured =
    result.experimental_output ??
    result.steps
      .flatMap((step) =>
        step.toolResults?.filter(
          (toolResult): toolResult is typeof toolResult & {
            toolCall: { name: "finalizeDiscovery" };
            result: z.infer<typeof discoveryResultSchema>;
          } => toolResult.toolCall.name === "finalizeDiscovery",
        ) ?? [],
      )
      .at(-1)?.result;

  if (!structured) {
    logger.error("stage.discovery.no_results");
    return [];
  }

  const news = structured.news
    .map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      publishedAt: item.timestamp,
      body: item.body_text_clean,
      source: item.source,
    }))
    .filter((item) => {
      try {
        discoveryNewsItemSchema.parse(item);
        return true;
      } catch (error) {
        logger.warn("stage.discovery.invalid_item", {
          id: item.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    });

  logger.info("stage.discovery.complete", { total: news.length });
  return news;
}
