import { task, wait, metadata, queue } from "@trigger.dev/sdk";
import { performance } from "node:perf_hooks";
import { getNumericEnv, loadEnv } from "@/config/env";
import type { Env } from "@/config/env";
import { logger } from "@/server/lib/logger";
import { runSummarizeStage } from "@/server/agent/stages/summarize";
import { runFormatStage } from "@/server/agent/stages/format";
import { runPersistStage } from "@/server/agent/stages/persist";
import { runCommentaryStage } from "@/server/agent/stages/commentary";
import {
  sendTelegramMessage,
  getDefaultChatId,
  sendTelegramPhoto,
} from "@/server/services/telegram/client";
import { getChartImage } from "@/server/services/market/chartImg";
import { escapeHtml, toISOString } from "@/lib/utils";
import {
  storedNewsRecordSchema,
  type RerankedNewsItem,
  type StructuredNewsItem,
  type FormattedNewsItem,
} from "@/types/news";
import { redis } from "@/server/services/storage/redis";
import type { SenderInput, SenderOutput } from "./types";

// Queue compartilhada para todos os envios
// Concurrency = 1 garante que apenas uma notícia é processada por vez
const newsQueue = queue({
  name: "news-sending",
  concurrencyLimit: 1,
});

const DEFAULT_COMMENTARY_DELAY_SECONDS = 7;
const B3_TICKER_REGEX = /^[A-Z0-9]{3,7}$/;
const FAILURE_COUNTER_KEY = "agent:news:failed_send_counter";

function buildCommentaryMessage(content: string): string {
  const escaped = escapeHtml(content.trim());
  return [
    "🤖💬 <b>Comentário</b>",
    escaped,
    "<i>(análise automatizada)</i>",
  ].join("\n");
}

function extractPrimaryTicker(tags: string[]): string | null {
  for (const tag of tags) {
    const normalized = tag.toUpperCase();
    if (B3_TICKER_REGEX.test(normalized)) {
      return normalized;
    }
    if (/^[A-Z0-9]{1,7}\.[A-Z0-9]{1,3}$/.test(normalized)) {
      return normalized.split(".")[0];
    }
  }
  return null;
}

function buildChartCaption(
  ticker: string,
  range: string,
  interval: string,
): string {
  return [
    `📊 <b>${escapeHtml(ticker)}</b> · ${escapeHtml(range.toUpperCase())}`,
    `<i>Intervalo ${escapeHtml(interval.toUpperCase())} · Chart-IMG</i>`,
  ].join("\n");
}

async function resetFailureCounter() {
  const client = redis();
  await client.del(FAILURE_COUNTER_KEY);
}

async function notifyAdminOfSenderFailure(params: {
  env: Env;
  newsId: string;
  channelId: string;
  error: string;
}) {
  const { env, newsId, channelId, error } = params;

  if (!env.TELEGRAM_ADMIN_CHAT_ID) {
    return;
  }

  try {
    const client = redis();
    const count = await client.incr(FAILURE_COUNTER_KEY);
    await client.expire(FAILURE_COUNTER_KEY, 3600);

    if (count >= 3) {
      await sendTelegramMessage({
        chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
        text: [
          "⚠️ RS News",
          `Falhas consecutivas no envio (${count}).`,
          `Última notícia: ${newsId} (${channelId}).`,
          `Erro: ${error}`,
        ].join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      await client.del(FAILURE_COUNTER_KEY);
    }
  } catch (notifyError) {
    logger.error("sender.failure_alert_failed", {
      newsId,
      channelId,
      error: notifyError instanceof Error ? notifyError.message : String(notifyError),
    });
  }
}

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
    const env = loadEnv();
    const channel = payload.channel;
    const baseCommentaryEnabled = env.ENABLE_ANALYSIS_COMMENTARY === "true";
    const baseChartEnabled = env.ENABLE_CHARTIMG === "true";
    const commentaryEnabled = channel.features?.commentary ?? baseCommentaryEnabled;
    const chartEnabled = channel.features?.chartImg ?? baseChartEnabled;
    const commentaryDelaySeconds = Math.max(
      0,
      getNumericEnv(
        env.ANALYSIS_COMMENTARY_DELAY_SECONDS,
        DEFAULT_COMMENTARY_DELAY_SECONDS,
      ),
    );
    const chatId = channel.chatId ?? getDefaultChatId();
    let structured: StructuredNewsItem | null = null;
    let formattedItem: FormattedNewsItem | null = null;
    let telegramMessageId: number | undefined;
    let commentaryMessageId: number | undefined;
    let commentaryText: string | null = null;
    let chartMessageId: number | undefined;
    let chartTicker: string | null = null;
    let chartEligible = false;

    logger.info("sender.start", {
      newsId: newsItem.newsId,
      title: newsItem.title,
      delayMinutes: payload.delayMinutes,
      channelId: channel.id,
    });

    // Adiciona metadata para tracking
    metadata.set("newsId", newsItem.newsId);
    metadata.set("channelId", channel.id);
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
          channelId: channel.id,
          error: "Summarization failed",
          sentAt: toISOString(new Date()),
        };
      }

      structured = summarizeResult.items[0];

      if (chartEnabled) {
        chartTicker = extractPrimaryTicker(structured.tags ?? []);
        chartEligible = Boolean(chartTicker) &&
          (structured.impact === "alta" || structured.impact === "média");
      }

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
          channelId: channel.id,
          error: "Formatting failed",
          sentAt: toISOString(new Date()),
        };
      }

      formattedItem = formatted[0];

      if (commentaryEnabled) {
        metadata.set("stage", "commentary-prep");
        metadata.set("progress", 50);
        logger.info("sender.commentary.generating", { newsId: newsItem.newsId });

        const commentaryResult = await runCommentaryStage(structured);
        if (commentaryResult) {
          commentaryText = commentaryResult;
          logger.info("sender.commentary.ready", {
            newsId: newsItem.newsId,
            length: commentaryResult.length,
          });
        } else {
          logger.warn("sender.commentary.skipped", {
            newsId: newsItem.newsId,
            reason: "generation_failed",
          });
        }
      }

      // Stage 4: Send to Telegram
      metadata.set("stage", "sending");
      metadata.set("progress", 60);
      logger.info("sender.sending_telegram", {
        newsId: newsItem.newsId,
        channelId: channel.id,
      });

      const response = await sendTelegramMessage({
        chat_id: chatId,
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
        channelId: channel.id,
      });

      // Stage 5: Persist
      metadata.set("stage", "persisting");
      metadata.set("progress", 80);
      logger.info("sender.persisting", {
        newsId: newsItem.newsId,
        channelId: channel.id,
      });

      const record = storedNewsRecordSchema.parse({
        ...formattedItem,
        telegramMessageId,
        sentAt: toISOString(new Date()),
        failedToSend: false,
      });

      await runPersistStage([record]);

      if (chartEnabled && chartEligible && chartTicker) {
        metadata.set("stage", "chart");
        metadata.set("progress", 85);
        const chartResult = await getChartImage({ ticker: chartTicker });

        if (chartResult) {
          const chartResponse = await sendTelegramPhoto({
            chat_id: chatId,
            photo: chartResult.url,
            caption: buildChartCaption(chartTicker, chartResult.range, chartResult.interval),
            parse_mode: "HTML",
          });

          if (chartResponse.ok && chartResponse.result) {
            chartMessageId = chartResponse.result.message_id;
            logger.info("sender.chart.sent", {
              newsId: newsItem.newsId,
              messageId: chartMessageId,
              ticker: chartTicker,
              range: chartResult.range,
              interval: chartResult.interval,
              channelId: channel.id,
            });
          } else {
            logger.warn("sender.chart.failed_to_send", {
              newsId: newsItem.newsId,
              ticker: chartTicker,
              description: chartResponse.description,
              channelId: channel.id,
            });
          }
        } else {
          logger.warn("sender.chart.skipped", {
            newsId: newsItem.newsId,
            ticker: chartTicker,
            reason: "fetch_failed_or_quota",
            channelId: channel.id,
          });
        }
      }

      if (commentaryText) {
        metadata.set("stage", "commentary");
        metadata.set("progress", 90);
        if (commentaryDelaySeconds > 0) {
          logger.info("sender.commentary.wait", {
            newsId: newsItem.newsId,
            delaySeconds: commentaryDelaySeconds,
            channelId: channel.id,
          });
          await wait.for({ seconds: commentaryDelaySeconds });
        }

        const commentaryResponse = await sendTelegramMessage({
          chat_id: chatId,
          text: buildCommentaryMessage(commentaryText),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });

        if (commentaryResponse.ok && commentaryResponse.result) {
          commentaryMessageId = commentaryResponse.result.message_id;
          logger.info("sender.commentary.sent", {
            newsId: newsItem.newsId,
            messageId: commentaryMessageId,
            channelId: channel.id,
          });
        } else {
          logger.warn("sender.commentary.failed_to_send", {
            newsId: newsItem.newsId,
            description: commentaryResponse.description,
            channelId: channel.id,
          });
        }
      }

      // Complete
      metadata.set("stage", "complete");
      metadata.set("progress", 100);

      const executionTimeMs = Math.round(performance.now() - start);

      logger.info("sender.complete", {
        newsId: newsItem.newsId,
        messageId: telegramMessageId,
        channelId: channel.id,
        chartMessageId,
        commentaryMessageId,
        executionTimeMs,
      });

      try {
        await resetFailureCounter();
      } catch (resetError) {
        logger.warn("sender.failure_counter_reset_failed", {
          newsId: newsItem.newsId,
          channelId: channel.id,
          error:
            resetError instanceof Error
              ? resetError.message
              : String(resetError),
        });
      }

      return {
        newsId: newsItem.newsId,
        sent: true,
        channelId: channel.id,
        telegramMessageId,
        sentAt: record.sentAt,
        chartMessageId,
        chartSent: Boolean(chartMessageId),
        commentaryMessageId,
        commentarySent: Boolean(commentaryMessageId),
      };
    } catch (error) {
      // Error handling
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("sender.failed", {
        newsId: newsItem.newsId,
        error: errorMessage,
        executionTimeMs: Math.round(performance.now() - start),
        channelId: channel.id,
      });

      metadata.set("stage", "failed");
      metadata.set("error", errorMessage);

      await notifyAdminOfSenderFailure({
        env,
        newsId: newsItem.newsId,
        channelId: channel.id,
        error: errorMessage,
      });

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
            channelId: channel.id,
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
              channelId: channel.id,
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
