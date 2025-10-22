import { z } from "zod";
import { buildDiscoveryPrompt } from "@/server/services/ai/prompts";
import { runGenerateObject } from "@/server/services/ai/gateway";
import { getModelName } from "@/server/services/ai/models";
import {
  type DiscoveryNewsItem,
  discoveryNewsItemSchema,
} from "@/types/news";
import { logger } from "@/server/lib/logger";

const discoveryResponseSchema = z.object({
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

  const prompt = buildDiscoveryPrompt(QUERIES, DOMAIN_WHITELIST);
  const response = await runGenerateObject(
    getModelName("DISCOVERY"),
    discoveryResponseSchema,
    prompt,
  );

  const news = response.news
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
