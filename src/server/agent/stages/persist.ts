import { setJson } from "@/server/services/storage/redis";
import { upsertDocument } from "@/server/services/storage/search";
import { logger } from "@/server/lib/logger";
import { buildFingerprintText, computeFingerprint, fingerprintToHex } from "@/server/lib/fingerprint";
import { type StoredNewsRecord } from "@/types/news";

function redisKey(newsId: string) {
  return `sent_news:${newsId}`;
}

export async function runPersistStage(records: StoredNewsRecord[]) {
  logger.info("stage.persist.start", { total: records.length });
  for (const record of records) {
    await setJson(redisKey(record.newsId), record);
    if (!record.failedToSend) {
      const fingerprintText = buildFingerprintText({
        title: record.normalizedTitle ?? record.finalTitle,
        body: record.body,
        summaryForSearch: record.summaryForSearch,
      });
      const fingerprint = computeFingerprint(fingerprintText);
      await upsertDocument(record.newsId, record.summaryForSearch, {
        title: record.finalTitle,
        url: record.url,
        companies: record.companies,
        topic: record.topic,
        tags: record.tags,
        timestamp: record.publishedAt,
        score: record.relevanceScore,
        telegramMessageId: record.telegramMessageId,
        ...(fingerprint ? { bodyFingerprint: fingerprintToHex(fingerprint) } : {}),
        normalizedTitle: record.normalizedTitle,
      });
    }
  }
  logger.info("stage.persist.complete", { total: records.length });
}
