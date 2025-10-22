import { z } from "zod";
import { buildSummarizePrompt } from "@/server/services/ai/prompts";
import { runGenerateObject } from "@/server/services/ai/gateway";
import { getModelName } from "@/lib/ai/models";
import {
  structuredNewsItemSchema,
  type RerankedNewsItem,
  type StructuredNewsItem,
} from "@/types/news";
import { logger } from "@/server/lib/logger";
import { validateCitations } from "@/server/agent/validator";

const summarizeResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()),
  citations: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      quote: z.string(),
      associatedBullet: z.number(),
    }),
  ),
  hashtags: z.array(z.string()),
  summary_for_search: z.string(),
});

export type SummarizeResult = {
  items: StructuredNewsItem[];
  failures: number;
};

export async function runSummarizeStage(
  items: RerankedNewsItem[],
): Promise<SummarizeResult> {
  logger.info("stage.summarize.start", { total: items.length });
  const summarized: StructuredNewsItem[] = [];
  let failures = 0;

  for (const item of items) {
    try {
      const prompt = buildSummarizePrompt(item);
      const response = await runGenerateObject(
        getModelName("summarize"),
        summarizeResponseSchema,
        prompt,
      );

      validateCitations(response.bullets, response.citations);

      const structured = structuredNewsItemSchema.parse({
        ...item,
        finalTitle: response.title.trim(),
        summary: response.summary.trim(),
        bullets: response.bullets.map((bullet) => bullet.trim()),
        citations: response.citations.map((citation) => ({
          ...citation,
          quote: citation.quote.trim(),
        })),
        hashtags: response.hashtags.map((hashtag) =>
          hashtag.startsWith("#") ? hashtag.toUpperCase() : `#${hashtag.toUpperCase()}`,
        ),
        summaryForSearch: response.summary_for_search.trim(),
      });
      summarized.push(structured);
    } catch (error) {
      failures += 1;
      logger.error("stage.summarize.failed", {
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("stage.summarize.complete", {
    total: items.length,
    success: summarized.length,
    failures,
  });

  return { items: summarized, failures };
}
