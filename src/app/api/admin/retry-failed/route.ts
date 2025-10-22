import { loadEnv } from "@/config/env";
import { redis, getJson, setJson } from "@/server/services/storage/redis";
import { upsertDocument } from "@/server/services/storage/search";
import { sendTelegramMessage, getDefaultChatId } from "@/server/services/telegram/client";
import { storedNewsRecordSchema, type StoredNewsRecord } from "@/types/news";

function isAuthorized(request: Request): boolean {
  const env = loadEnv();
  if (!env.CRON_SECRET) {
    return true;
  }
  const header = request.headers.get("authorization");
  if (!header) return false;
  const [type, token] = header.split(" ");
  return type === "Bearer" && token === env.CRON_SECRET;
}

async function listFailedRecords(): Promise<StoredNewsRecord[]> {
  let cursor = "0";
  const records: StoredNewsRecord[] = [];
  do {
    const [nextCursor, keys] = (await redis().scan(cursor, {
      match: "sent_news:*",
      count: 100,
    })) as [string, string[]];
    cursor = nextCursor;
    for (const key of keys) {
      const record = await getJson<StoredNewsRecord>(key);
      if (record && record.failedToSend) {
        records.push(storedNewsRecordSchema.parse(record));
      }
    }
  } while (cursor !== "0");
  return records;
}

async function retryRecord(record: StoredNewsRecord): Promise<StoredNewsRecord> {
  const response = await sendTelegramMessage({
    chat_id: getDefaultChatId(),
    text: record.messageHtml,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (!response.ok || !response.result) {
    return record;
  }
  const updated = storedNewsRecordSchema.parse({
    ...record,
    telegramMessageId: response.result.message_id,
    failedToSend: false,
    sentAt: new Date(response.result.date * 1000).toISOString(),
  });
  await setJson(`sent_news:${record.newsId}`, updated);
  await upsertDocument(updated.newsId, updated.summaryForSearch, {
    title: updated.finalTitle,
    url: updated.url,
    companies: updated.companies,
    timestamp: updated.publishedAt,
    score: updated.relevanceScore,
    telegramMessageId: updated.telegramMessageId,
  });
  return updated;
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const failedRecords = await listFailedRecords();
  const retried: StoredNewsRecord[] = [];
  for (const record of failedRecords) {
    const updated = await retryRecord(record);
    if (!updated.failedToSend) {
      retried.push(updated);
    }
  }

  return Response.json({
    totalFailed: failedRecords.length,
    retried: retried.length,
  });
}

export const POST = handleRequest;
