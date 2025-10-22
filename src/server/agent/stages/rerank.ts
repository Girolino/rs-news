import { z } from "zod";
import { buildRerankPrompt } from "@/server/services/ai/prompts";
import { runGenerateObject } from "@/server/services/ai/gateway";
import { getModelName } from "@/lib/ai/models";
import {
  prefilteredNewsItemSchema,
  rerankedNewsItemSchema,
  type PrefilteredNewsItem,
  type RerankedNewsItem,
} from "@/types/news";
import { logger } from "@/server/lib/logger";
import { getNumericEnv, loadEnv } from "@/config/env";

const rerankResponseSchema = z.object({
  news: z.array(
    z.object({
      id: z.string(),
      relevanceScore: z.number(),
      impact: z.enum(["alta", "média", "baixa"]),
      companies: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      shouldProcess: z.boolean(),
    }),
  ),
});

const DEFAULT_MAX_NEWS = 10;
const DEFAULT_THRESHOLD = 7;

export type RerankResult = {
  items: RerankedNewsItem[];
  skipped: number;
};

export async function runRerankStage(
  prefiltered: PrefilteredNewsItem[],
): Promise<RerankResult> {
  logger.info("stage.rerank.start", { total: prefiltered.length });
  const env = loadEnv();
  const maxNewsPerRun = getNumericEnv(
    env.MAX_NEWS_PER_RUN,
    DEFAULT_MAX_NEWS,
  );
  const relevanceThreshold = getNumericEnv(
    env.RELEVANCE_THRESHOLD,
    DEFAULT_THRESHOLD,
  );

  if (prefiltered.length === 0) {
    return { items: [], skipped: 0 };
  }

  prefiltered.forEach((item) => prefilteredNewsItemSchema.parse(item));

  const prompt = buildRerankPrompt(prefiltered, maxNewsPerRun);
  const response = await runGenerateObject(
    getModelName("rerank"),
    rerankResponseSchema,
    prompt,
  );

  const reranked: RerankedNewsItem[] = [];
  let skipped = 0;
  for (const item of response.news) {
    const source = prefiltered.find((news) => news.id === item.id);
    if (!source) {
      logger.warn("stage.rerank.missing_source", { id: item.id });
      skipped += 1;
      continue;
    }
    const enriched = {
      ...source,
      relevanceScore: item.relevanceScore,
      impact: item.impact,
      companies: item.companies ?? [],
      categories: item.categories ?? [],
      shouldProcess: item.shouldProcess,
    };
    if (!enriched.shouldProcess || enriched.relevanceScore < relevanceThreshold) {
      skipped += 1;
      continue;
    }
    rerankedNewsItemSchema.parse(enriched);
    reranked.push(enriched);
  }

  const limited = reranked.slice(0, maxNewsPerRun);

  logger.info("stage.rerank.complete", {
    totalPrefiltered: prefiltered.length,
    passed: limited.length,
    skipped,
  });

  return { items: limited, skipped };
}
