import { getNumericEnv, loadEnv } from "@/config/env";
import { logger } from "@/server/lib/logger";
import { buildFingerprintText, computeFingerprint, fingerprintFromHex, hammingDistance } from "@/server/lib/fingerprint";
import { searchIndex } from "@/server/services/storage/search";
import {
  type RerankedNewsItem,
  rerankedNewsItemSchema,
} from "@/types/news";

const DEFAULT_THRESHOLD = 0.9;
const DEFAULT_SIMHASH_DISTANCE = 12;

export type DedupResult = {
  items: RerankedNewsItem[];
  duplicates: number;
};

export async function runDedupStage(
  reranked: RerankedNewsItem[],
  options?: {
    similarityThreshold?: number;
    simhashDistanceThreshold?: number;
  },
): Promise<DedupResult> {
  logger.info("stage.dedup.start", { total: reranked.length });
  const env = loadEnv();
  const threshold =
    options?.similarityThreshold ??
    getNumericEnv(env.DEDUP_SIMILARITY_THRESHOLD, DEFAULT_THRESHOLD);
  const simhashThreshold =
    options?.simhashDistanceThreshold ??
    getNumericEnv(
      env.DEDUP_SIMHASH_DISTANCE_THRESHOLD,
      DEFAULT_SIMHASH_DISTANCE,
    );
  const uniqueItems: RerankedNewsItem[] = [];
  let duplicates = 0;

  for (const item of reranked) {
    rerankedNewsItemSchema.parse(item);

    const fingerprintText = buildFingerprintText({
      title: item.normalizedTitle ?? item.title,
      body: item.body,
    });
    const fingerprint = computeFingerprint(fingerprintText);

    try {
      const result = await searchIndex().search({
        query: item.title,
        limit: 3,
        reranking: true,
      });
      const hasDuplicate = result.some((doc: { score: number; metadata?: Record<string, unknown> }) => {
        if (doc.score >= threshold) {
          return true;
        }
        if (!fingerprint || !doc.metadata) {
          return false;
        }
        const rawFingerprint =
          typeof doc.metadata.bodyFingerprint === "string"
            ? doc.metadata.bodyFingerprint
            : typeof doc.metadata.fingerprint === "string"
              ? doc.metadata.fingerprint
              : undefined;
        const storedFingerprint = fingerprintFromHex(rawFingerprint);
        if (!storedFingerprint) {
          return false;
        }
        const distance = hammingDistance(fingerprint, storedFingerprint);
        const match = distance <= simhashThreshold;
        if (match) {
          logger.info("stage.dedup.simhash_match", {
            id: item.id,
            distance,
            threshold: simhashThreshold,
          });
        }
        return match;
      });
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
