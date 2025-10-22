import { getNumericEnv, loadEnv } from "@/config/env";
import { logger } from "@/server/lib/logger";
import { searchIndex } from "@/server/services/storage/search";
import {
  type RerankedNewsItem,
  rerankedNewsItemSchema,
} from "@/types/news";

const DEFAULT_THRESHOLD = 0.9;

export type DedupResult = {
  items: RerankedNewsItem[];
  duplicates: number;
};

export async function runDedupStage(
  reranked: RerankedNewsItem[],
): Promise<DedupResult> {
  logger.info("stage.dedup.start", { total: reranked.length });
  const env = loadEnv();
  const threshold = getNumericEnv(
    env.DEDUP_SIMILARITY_THRESHOLD,
    DEFAULT_THRESHOLD,
  );
  const uniqueItems: RerankedNewsItem[] = [];
  let duplicates = 0;

  for (const item of reranked) {
    rerankedNewsItemSchema.parse(item);
    try {
      const result = await searchIndex().search({
        query: item.title,
        limit: 3,
        reranking: true,
      });
      const hasDuplicate = result.some((doc: { score: number }) => doc.score >= threshold);
      if (hasDuplicate) {
        duplicates += 1;
        logger.info("stage.dedup.duplicate_found", {
          id: item.id,
          threshold,
        });
        continue;
      }
    } catch (error) {
      logger.error("stage.dedup.search_failed", {
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // If search fails, allow item to proceed to avoid missing news due to transient errors.
    }
    uniqueItems.push(item);
  }

  logger.info("stage.dedup.complete", {
    duplicates,
    passing: uniqueItems.length,
  });

  return { items: uniqueItems, duplicates };
}
