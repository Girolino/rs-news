import { task, wait, metadata, queue } from "@trigger.dev/sdk";
import { performance } from "node:perf_hooks";
import { logger } from "@/server/lib/logger";
import { runSummarizeStage } from "@/server/agent/stages/summarize";
import { runFormatStage } from "@/server/agent/stages/format";
import { runPersistStage } from "@/server/agent/stages/persist";
import {
  sendTelegramMessage,
  getDefaultChatId,
} from "@/server/services/telegram/client";
import { toISOString } from "@/lib/utils";
import {
  storedNewsRecordSchema,
  type RerankedNewsItem,
  type StructuredNewsItem,
  type FormattedNewsItem,
} from "@/types/news";
import type { SenderInput, SenderOutput } from "./types";

// Queue compartilhada para todos os envios
// Concurrency = 1 garante que apenas uma notícia é processada por vez
const newsQueue = queue({
  name: "news-sending",
  concurrencyLimit: 1,
});

/**
 * Task de Envio Individual de Notícia
 *
 * Esta task processa uma única notícia por vez e executa:
 * 1. Wait (delay configurável) - para simular curadoria humana
 * 2. Summarize - LLM gera título, bullets, citations
 * 3. Format - converte para HTML do Telegram
 * 4. Send - envia para o canal Telegram
 * 5. Persist - salva no Redis e Upstash Search
 *
 * A task usa uma queue com concurrency=1 para garantir que
 * as notícias sejam enviadas sequencialmente com delays naturais.
 *
 * Retry automático: 3 tentativas com backoff exponencial para
 * falhas do Telegram ou transient errors.
 */
export const newsSenderTask = task({
  id: "news-sender",

  // Queue com concurrency limit
  queue: newsQueue,

  // Retry configuration para falhas do Telegram
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },

  // Machine pequena é suficiente para envio
  machine: { preset: "small-1x" },

  // Max 5 minutos por notícia
  maxDuration: 300,

  run: async (payload: SenderInput): Promise<SenderOutput> => {
    const start = performance.now();
    const newsItem = payload.newsItem as RerankedNewsItem;
    let structured: StructuredNewsItem | null = null;
    let formattedItem: FormattedNewsItem | null = null;
    let telegramMessageId: number | undefined;

    logger.info("sender.start", {
      newsId: newsItem.newsId,
      title: newsItem.title,
      delayMinutes: payload.delayMinutes,
    });

    // Adiciona metadata para tracking
    metadata.set("newsId", newsItem.newsId);
    metadata.set("stage", "waiting");
    metadata.set("progress", 0);

    // Stage 1: Wait (delay para simular curadoria humana)
    if (payload.delayMinutes && payload.delayMinutes > 0) {
      logger.info("sender.waiting", {
        newsId: newsItem.newsId,
        delayMinutes: payload.delayMinutes,
      });

      await wait.for({
        minutes: payload.delayMinutes,
      });

      logger.info("sender.wait_complete", {
        newsId: newsItem.newsId,
      });
    }

    try {
      // Stage 2: Summarize
      metadata.set("stage", "summarizing");
      metadata.set("progress", 20);
      logger.info("sender.summarizing", { newsId: newsItem.newsId });

      const summarizeResult = await runSummarizeStage([newsItem]);

      if (summarizeResult.items.length === 0) {
        logger.error("sender.summarize_failed", {
          newsId: newsItem.newsId,
          error: "Summarization returned no items",
        });

        return {
          newsId: newsItem.newsId,
          sent: false,
          error: "Summarization failed",
          sentAt: toISOString(new Date()),
        };
      }

      structured = summarizeResult.items[0];

      // Stage 3: Format
      metadata.set("stage", "formatting");
      metadata.set("progress", 40);
      logger.info("sender.formatting", { newsId: newsItem.newsId });

      const formatted = runFormatStage([structured]);

      if (formatted.length === 0) {
        logger.error("sender.format_failed", {
          newsId: newsItem.newsId,
          error: "Formatting returned no items",
        });

        return {
          newsId: newsItem.newsId,
          sent: false,
          error: "Formatting failed",
          sentAt: toISOString(new Date()),
        };
      }

      formattedItem = formatted[0];

      // Stage 4: Send to Telegram
      metadata.set("stage", "sending");
      metadata.set("progress", 60);
      logger.info("sender.sending_telegram", { newsId: newsItem.newsId });

      const response = await sendTelegramMessage({
        chat_id: getDefaultChatId(),
        text: formattedItem.messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      if (!response.ok || !response.result) {
        throw new Error(
          response.description ?? "Unknown Telegram response"
        );
      }

      telegramMessageId = response.result.message_id;

      logger.info("sender.telegram_sent", {
        newsId: newsItem.newsId,
        messageId: telegramMessageId,
      });

      // Stage 5: Persist
      metadata.set("stage", "persisting");
      metadata.set("progress", 80);
      logger.info("sender.persisting", { newsId: newsItem.newsId });

      const record = storedNewsRecordSchema.parse({
        ...formattedItem,
        telegramMessageId,
        sentAt: toISOString(new Date()),
        failedToSend: false,
      });

      await runPersistStage([record]);

      // Complete
      metadata.set("stage", "complete");
      metadata.set("progress", 100);

      const executionTimeMs = Math.round(performance.now() - start);

      logger.info("sender.complete", {
        newsId: newsItem.newsId,
        messageId: telegramMessageId,
        executionTimeMs,
      });

      return {
        newsId: newsItem.newsId,
        sent: true,
        telegramMessageId,
        sentAt: record.sentAt,
      };
    } catch (error) {
      // Error handling
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("sender.failed", {
        newsId: newsItem.newsId,
        error: errorMessage,
        executionTimeMs: Math.round(performance.now() - start),
      });

      metadata.set("stage", "failed");
      metadata.set("error", errorMessage);

      // Se falhar após todas as tentativas de retry, persiste como failed
      // Evita repetir summarize: reutiliza resultados já calculados
      const failureSentAt = toISOString(new Date());

      try {
        if (formattedItem) {
          const failedRecord = storedNewsRecordSchema.parse({
            ...formattedItem,
            sentAt: failureSentAt,
            failedToSend: true,
          });
          await runPersistStage([failedRecord]);
          logger.info("sender.failed_record_persisted", {
            newsId: newsItem.newsId,
          });
        } else if (structured) {
          const formattedFallback = runFormatStage([structured]);
          if (formattedFallback.length > 0) {
            const failedRecord = storedNewsRecordSchema.parse({
              ...formattedFallback[0],
              sentAt: failureSentAt,
              failedToSend: true,
            });
            await runPersistStage([failedRecord]);
            logger.info("sender.failed_record_persisted", {
              newsId: newsItem.newsId,
            });
          }
        }
      } catch (persistError) {
        logger.error("sender.failed_record_persist_error", {
          newsId: newsItem.newsId,
          error:
            persistError instanceof Error
              ? persistError.message
              : String(persistError),
        });
      }

      // Re-throw error para que a task seja marcada como failed
      // e o retry automático do Trigger.dev funcione
      throw error;
    }
  },
});
