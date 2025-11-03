import { schedules, metadata } from "@trigger.dev/sdk";
import { performance } from "node:perf_hooks";
import { logger } from "@/server/lib/logger";
import { runDiscoveryStage } from "@/server/agent/stages/discovery";
import { runPrefilterStage } from "@/server/agent/stages/prefilter";
import { runRerankStage } from "@/server/agent/stages/rerank";
import { runDedupStage } from "@/server/agent/stages/dedup";
import { setJson, redis } from "@/server/services/storage/redis";
import { MAX_SENDER_DELAY_MINUTES, type OrchestratorOutput } from "./types";
import { newsSenderTask } from "./sender.task";
import { acquireLock, releaseLock } from "@/server/lib/lock";
import { CHANNELS, type ChannelConfig } from "@/config/channels";
import type { RerankedNewsItem } from "@/types/news";
import { loadEnv } from "@/config/env";
import { sendTelegramMessage } from "@/server/services/telegram/client";

const LAST_RUN_METADATA_KEY = "agent:news:last_run";
const LOCK_KEY = "cron:news:lock";
const LOCK_TTL_SECONDS = 600;
const MIN_DELAY_MINUTES = 2;
const RANDOM_DELAY_SPAN = 3; // Produz delays aleatórios entre 2-5 minutos

type ChannelRunResult = {
  channelId: string;
  discoveredCount: number;
  filteredCount: number;
  relevantCount: number;
  duplicateCount: number;
  queuedForSendingCount: number;
  status: string;
  senderBatchId?: string;
};

function applyChannelFilters(
  items: RerankedNewsItem[],
  channel: ChannelConfig,
): RerankedNewsItem[] {
  const filters = channel.filters;
  if (!filters) {
    return items;
  }

  return items.filter((item) => {
    if (filters.allowedTickers && filters.allowedTickers.length > 0) {
      const tickers = item.companies?.map((company) => company.toUpperCase()) ?? [];
      const hasTicker = tickers.some((company) =>
        filters.allowedTickers?.some((allowed) =>
          company === allowed.toUpperCase(),
        ),
      );
      if (!hasTicker) {
        return false;
      }
    }

    if (filters.allowedCategories && filters.allowedCategories.length > 0) {
      const categories = item.categories ?? [];
      const hasCategory = categories.some((category) =>
        filters.allowedCategories?.includes(category),
      );
      if (!hasCategory) {
        return false;
      }
    }

    return true;
  });
}

async function processChannel(channel: ChannelConfig): Promise<ChannelRunResult> {
  metadata.set("channelId", channel.id);
  metadata.set("channelLabel", channel.label);
  metadata.set("stage", `channel:${channel.id}:acquiring_lock`);
  metadata.set("progress", 5);

  const channelLockKey = `${LOCK_KEY}:${channel.id}`;
  const channelLock = await acquireLock(channelLockKey, LOCK_TTL_SECONDS);

  if (!channelLock) {
    logger.warn("orchestrator.channel_lock_exists", {
      channelId: channel.id,
    });
    return {
      channelId: channel.id,
      discoveredCount: 0,
      filteredCount: 0,
      relevantCount: 0,
      duplicateCount: 0,
      queuedForSendingCount: 0,
      status: "lock_exists",
    };
  }

  metadata.set("stage", `channel:${channel.id}:discovery`);
  metadata.set("progress", 10);

  try {
    const discovered = await runDiscoveryStage({
      additionalTopics: channel.discovery?.additionalTopics,
      whitelist: channel.discovery?.whitelist,
    });

    logger.info("orchestrator.discovery.complete", {
      channelId: channel.id,
      count: discovered.length,
    });

    if (discovered.length === 0) {
      return {
        channelId: channel.id,
        discoveredCount: 0,
        filteredCount: 0,
        relevantCount: 0,
        duplicateCount: 0,
        queuedForSendingCount: 0,
        status: "no_news",
      };
    }

    metadata.set("stage", `channel:${channel.id}:prefilter`);
    metadata.set("progress", 30);
    const prefilterResult = runPrefilterStage(discovered);
    logger.info("orchestrator.prefilter.complete", {
      channelId: channel.id,
      passed: prefilterResult.items.length,
      discarded: prefilterResult.discarded,
    });

    if (prefilterResult.items.length === 0) {
      return {
        channelId: channel.id,
        discoveredCount: discovered.length,
        filteredCount: prefilterResult.discarded,
        relevantCount: 0,
        duplicateCount: 0,
        queuedForSendingCount: 0,
        status: "all_filtered",
      };
    }

    metadata.set("stage", `channel:${channel.id}:rerank`);
    metadata.set("progress", 50);
    const rerankResult = await runRerankStage(prefilterResult.items, {
      maxNewsPerRun: channel.thresholds?.maxNewsPerRun,
      relevanceThreshold: channel.thresholds?.relevanceThreshold,
    });
    logger.info("orchestrator.rerank.complete", {
      channelId: channel.id,
      passed: rerankResult.items.length,
      skipped: rerankResult.skipped,
    });

    if (rerankResult.items.length === 0) {
      return {
        channelId: channel.id,
        discoveredCount: discovered.length,
        filteredCount: prefilterResult.discarded,
        relevantCount: 0,
        duplicateCount: 0,
        queuedForSendingCount: 0,
        status: "none_relevant",
      };
    }

    metadata.set("stage", `channel:${channel.id}:dedup`);
    metadata.set("progress", 70);
    const dedupResult = await runDedupStage(rerankResult.items, {
      similarityThreshold: channel.thresholds?.dedupSimilarityThreshold,
      simhashDistanceThreshold: channel.thresholds?.simhashDistanceThreshold,
    });
    logger.info("orchestrator.dedup.complete", {
      channelId: channel.id,
      unique: dedupResult.items.length,
      duplicates: dedupResult.duplicates,
    });

    if (dedupResult.items.length === 0) {
      return {
        channelId: channel.id,
        discoveredCount: discovered.length,
        filteredCount: prefilterResult.discarded,
        relevantCount: rerankResult.items.length,
        duplicateCount: dedupResult.duplicates,
        queuedForSendingCount: 0,
        status: "all_duplicates",
      };
    }

    const filteredByChannel = applyChannelFilters(dedupResult.items, channel);
    const filteredOutByChannel = dedupResult.items.length - filteredByChannel.length;

    if (filteredByChannel.length === 0) {
      logger.warn("orchestrator.channel_filtered_all", {
        channelId: channel.id,
      });
      return {
        channelId: channel.id,
        discoveredCount: discovered.length,
        filteredCount: prefilterResult.discarded,
        relevantCount: rerankResult.items.length,
        duplicateCount: dedupResult.duplicates,
        queuedForSendingCount: 0,
        status: "filtered_by_channel",
      };
    }

    metadata.set("stage", `channel:${channel.id}:triggering_senders`);
    metadata.set("progress", 85);

    const sendDelays: number[] = [];
    let cumulativeDelay = 0;
    for (let i = 0; i < filteredByChannel.length; i++) {
      if (i === 0) {
        sendDelays.push(0);
        continue;
      }
      const randomDelay = MIN_DELAY_MINUTES + Math.random() * RANDOM_DELAY_SPAN;
      cumulativeDelay = Math.min(
        cumulativeDelay + randomDelay,
        MAX_SENDER_DELAY_MINUTES,
      );
      sendDelays.push(Math.round(cumulativeDelay * 10) / 10);
    }

    logger.info("orchestrator.triggering_senders", {
      channelId: channel.id,
      count: filteredByChannel.length,
      delays: sendDelays,
      filteredOutByChannel,
      maxDelayMinutes: MAX_SENDER_DELAY_MINUTES,
    });

    let batchId: string | undefined;
    if (filteredByChannel.length > 0) {
      const batchHandle = await newsSenderTask.batchTrigger(
        filteredByChannel.map((item, index) => ({
          payload: {
            newsItem: item,
            delayMinutes: sendDelays[index],
            channel: {
              id: channel.id,
              chatId: channel.chatId,
              features: channel.features,
            },
          },
        })),
      );

      batchId = batchHandle.batchId;

      logger.info("orchestrator.senders_triggered", {
        channelId: channel.id,
        count: filteredByChannel.length,
        batchId,
      });
    }

    metadata.set("stage", `channel:${channel.id}:complete`);
    metadata.set("progress", 90);

    return {
      channelId: channel.id,
      discoveredCount: discovered.length,
      filteredCount: prefilterResult.discarded,
      relevantCount: rerankResult.items.length,
      duplicateCount: dedupResult.duplicates,
      queuedForSendingCount: filteredByChannel.length,
      status: "success",
      senderBatchId: batchId,
    };
  } catch (error) {
    logger.error("orchestrator.channel_error", {
      channelId: channel.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      channelId: channel.id,
      discoveredCount: 0,
      filteredCount: 0,
      relevantCount: 0,
      duplicateCount: 0,
      queuedForSendingCount: 0,
      status: "error",
    };
  }
  finally {
    await releaseLock(channelLock);
  }
}

async function notifyAdmin(message: string) {
  const env = loadEnv();
  if (!env.TELEGRAM_ADMIN_CHAT_ID) {
    return;
  }

  try {
    await sendTelegramMessage({
      chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
      text: `⚠️ RS News\n${message}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (error) {
    logger.error("orchestrator.notify_admin_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Task de Orquestração de Notícias
 *
 * Esta task é scheduled e executa os seguintes stages:
 * 1. Discovery - busca notícias com OpenAI web search
 * 2. Prefilter - filtra por qualidade, idade, idioma
 * 3. Rerank - LLM classifica relevância e impacto
 * 4. Dedup - verifica duplicatas no Upstash Search
 *
 * Para cada notícia aprovada, dispara a task de envio individual
 * com delays incrementais para simular curadoria humana.
 *
 * Horários: Segunda-Sexta 6h-19h (America/Sao_Paulo)
 */
export const newsOrchestratorTask = schedules.task({
  id: "news-orchestrator",

  // Schedule: Segunda-Sexta das 6h às 19h (hourly)
  cron: {
    pattern: "0 6-19 * * 1-5", // Mon-Fri 6am-7pm hourly
    timezone: "America/Sao_Paulo",
  },

  // Configuração de retry
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 60000,
  },

  // Machine com mais recursos para web search
  machine: { preset: "medium-1x" },

  // Max 15 minutos (discovery pode ser lenta)
  maxDuration: 900,

  run: async (payload) => {
    const start = performance.now();
    metadata.set("stage", "acquiring_lock");
    metadata.set("progress", 0);

    const lock = await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);

    if (!lock) {
      logger.warn("orchestrator.lock_exists", {
        timestamp: payload.timestamp,
      });

      metadata.set("stage", "skipped");
      metadata.set("reason", "lock_exists");

      const skippedResult: OrchestratorOutput = {
        discoveredCount: 0,
        filteredCount: 0,
        relevantCount: 0,
        duplicateCount: 0,
        queuedForSendingCount: 0,
        executionTimeMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        channels: [],
      };

      await setJson(LAST_RUN_METADATA_KEY, {
        ...skippedResult,
        status: "skipped_existing_lock",
      });

      return skippedResult;
    }

    try {
      logger.info("orchestrator.start", {
        timestamp: payload.timestamp,
        scheduleId: payload.scheduleId,
        channelCount: CHANNELS.length,
      });

      const channelResults: ChannelRunResult[] = [];
      for (const channel of CHANNELS) {
        const channelResult = await processChannel(channel);
        channelResults.push(channelResult);
      }

      metadata.set("stage", "complete");
      metadata.set("progress", 100);

      const executionTimeMs = Math.round(performance.now() - start);
      const aggregated: OrchestratorOutput = {
        discoveredCount: channelResults.reduce(
          (acc, result) => acc + result.discoveredCount,
          0,
        ),
        filteredCount: channelResults.reduce(
          (acc, result) => acc + result.filteredCount,
          0,
        ),
        relevantCount: channelResults.reduce(
          (acc, result) => acc + result.relevantCount,
          0,
        ),
        duplicateCount: channelResults.reduce(
          (acc, result) => acc + result.duplicateCount,
          0,
        ),
        queuedForSendingCount: channelResults.reduce(
          (acc, result) => acc + result.queuedForSendingCount,
          0,
        ),
        executionTimeMs,
        timestamp: new Date().toISOString(),
        channels: channelResults,
      };

      const client = redis();
      await client.lpush("agent:news:runs", JSON.stringify(aggregated));
      await client.ltrim("agent:news:runs", 0, 49);

      let zeroSendStreak = 0;
      if (aggregated.queuedForSendingCount === 0) {
        zeroSendStreak = await client.incr("agent:news:zero_send_streak");
      } else {
        await client.del("agent:news:zero_send_streak");
      }

      if (zeroSendStreak === 3) {
        await notifyAdmin(
          `Nenhuma notícia enviada nas últimas ${zeroSendStreak} execuções consecutivas.`,
        );
      }

      const errorChannels = aggregated.channels.filter(
        (channel) => channel.status === "error",
      );
      if (errorChannels.length > 0) {
        await notifyAdmin(
          `Falha ao processar canais: ${errorChannels
            .map((ch) => ch.channelId)
            .join(", ")}.`,
        );
      }

      await setJson(LAST_RUN_METADATA_KEY, {
        ...aggregated,
        status: "success",
      });

      logger.info("orchestrator.complete", aggregated);

      return aggregated;
    } finally {
      await releaseLock(lock);
    }
  },
});

export { processChannel };
