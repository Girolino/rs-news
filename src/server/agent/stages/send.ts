import { logger } from "@/server/lib/logger";
import {
  sendTelegramMessage,
  getDefaultChatId,
} from "@/server/services/telegram/client";
import {
  type FormattedNewsItem,
  type StoredNewsRecord,
  storedNewsRecordSchema,
} from "@/types/news";
import { toISOString } from "@/lib/utils";

export type SendResult = {
  sent: StoredNewsRecord[];
  failed: StoredNewsRecord[];
};

export async function runSendStage(
  items: FormattedNewsItem[],
): Promise<SendResult> {
  const sent: StoredNewsRecord[] = [];
  const failed: StoredNewsRecord[] = [];
  logger.info("stage.send.start", { total: items.length });

  for (const item of items) {
    try {
      const response = await sendTelegramMessage({
        chat_id: getDefaultChatId(),
        text: item.messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      if (!response.ok || !response.result) {
        throw new Error(response.description ?? "Unknown Telegram response");
      }
      const record = storedNewsRecordSchema.parse({
        ...item,
        telegramMessageId: response.result.message_id,
        sentAt: toISOString(new Date()),
        failedToSend: false,
      });
      sent.push(record);
    } catch (error) {
      logger.error("stage.send.failed", {
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      const record = storedNewsRecordSchema.parse({
        ...item,
        sentAt: toISOString(new Date()),
        failedToSend: true,
      });
      failed.push(record);
    }
  }

  logger.info("stage.send.complete", {
    sent: sent.length,
    failed: failed.length,
  });

  return { sent, failed };
}
