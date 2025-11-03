import { z } from "zod";
import { logger } from "@/server/lib/logger";
import { buildCommentaryPrompt } from "@/server/services/ai/prompts";
import { runGenerateObject } from "@/server/services/ai/gateway";
import { getModelName } from "@/lib/ai/models";
import type { StructuredNewsItem } from "@/types/news";

const commentarySchema = z.object({
  commentary: z.string().min(1).max(260),
});

export async function runCommentaryStage(
  news: StructuredNewsItem,
): Promise<string | null> {
  const prompt = buildCommentaryPrompt(news);
  try {
    logger.info("stage.commentary.start", {
      newsId: news.newsId,
    });

    const response = await runGenerateObject(
      getModelName("commentary"),
      commentarySchema,
      prompt,
    );

    const text = response.commentary.trim();

    if (!text) {
      logger.warn("stage.commentary.empty", { newsId: news.newsId });
      return null;
    }

    logger.info("stage.commentary.complete", {
      newsId: news.newsId,
      length: text.length,
    });

    return text;
  } catch (error) {
    logger.error("stage.commentary.failed", {
      newsId: news.newsId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
