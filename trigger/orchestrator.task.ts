import { schedules, metadata } from "@trigger.dev/sdk";
import { performance } from "node:perf_hooks";
import { logger } from "@/server/lib/logger";
import { runDiscoveryStage } from "@/server/agent/stages/discovery";
import { runPrefilterStage } from "@/server/agent/stages/prefilter";
import { runRerankStage } from "@/server/agent/stages/rerank";
import { runDedupStage } from "@/server/agent/stages/dedup";
import { setJson } from "@/server/services/storage/redis";
import { MAX_SENDER_DELAY_MINUTES, type OrchestratorOutput } from "./types";
import { newsSenderTask } from "./sender.task";
import { acquireLock, releaseLock } from "@/server/lib/lock";

const LAST_RUN_METADATA_KEY = "agent:news:last_run";
const LOCK_KEY = "cron:news:lock";
const LOCK_TTL_SECONDS = 600;
const MIN_DELAY_MINUTES = 2;
const RANDOM_DELAY_SPAN = 3; // Produz delays aleatórios entre 2-5 minutos

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
      });

      // Stage 1: Discovery
      metadata.set("stage", "discovery");
      metadata.set("progress", 10);
      const discovered = await runDiscoveryStage();
      logger.info("orchestrator.discovery.complete", {
        count: discovered.length,
      });

      if (discovered.length === 0) {
        logger.warn("orchestrator.no_news_discovered");
        const result: OrchestratorOutput = {
          discoveredCount: 0,
          filteredCount: 0,
          relevantCount: 0,
          duplicateCount: 0,
          queuedForSendingCount: 0,
          executionTimeMs: Math.round(performance.now() - start),
          timestamp: new Date().toISOString(),
        };

        await setJson(LAST_RUN_METADATA_KEY, {
          ...result,
          status: "no_news_found",
        });

        return result;
      }

      // Stage 2: Prefilter
      metadata.set("stage", "prefilter");
      metadata.set("progress", 30);
      const prefilterResult = runPrefilterStage(discovered);
      logger.info("orchestrator.prefilter.complete", {
        passed: prefilterResult.items.length,
        discarded: prefilterResult.discarded,
      });

      if (prefilterResult.items.length === 0) {
        logger.warn("orchestrator.no_news_after_prefilter");
        const result: OrchestratorOutput = {
          discoveredCount: discovered.length,
          filteredCount: prefilterResult.discarded,
          relevantCount: 0,
          duplicateCount: 0,
          queuedForSendingCount: 0,
          executionTimeMs: Math.round(performance.now() - start),
          timestamp: new Date().toISOString(),
        };

        await setJson(LAST_RUN_METADATA_KEY, {
          ...result,
          status: "all_filtered",
        });

        return result;
      }

      // Stage 3: Rerank
      metadata.set("stage", "rerank");
      metadata.set("progress", 50);
      const rerankResult = await runRerankStage(prefilterResult.items);
      logger.info("orchestrator.rerank.complete", {
        passed: rerankResult.items.length,
        skipped: rerankResult.skipped,
      });

      if (rerankResult.items.length === 0) {
        logger.warn("orchestrator.no_news_after_rerank");
        const result: OrchestratorOutput = {
          discoveredCount: discovered.length,
          filteredCount: prefilterResult.discarded,
          relevantCount: 0,
          duplicateCount: 0,
          queuedForSendingCount: 0,
          executionTimeMs: Math.round(performance.now() - start),
          timestamp: new Date().toISOString(),
        };

        await setJson(LAST_RUN_METADATA_KEY, {
          ...result,
          status: "none_relevant",
        });

        return result;
      }

      // Stage 4: Dedup
      metadata.set("stage", "dedup");
      metadata.set("progress", 70);
      const dedupResult = await runDedupStage(rerankResult.items);
      logger.info("orchestrator.dedup.complete", {
        unique: dedupResult.items.length,
        duplicates: dedupResult.duplicates,
      });

      if (dedupResult.items.length === 0) {
        logger.warn("orchestrator.all_duplicates");
        const result: OrchestratorOutput = {
          discoveredCount: discovered.length,
          filteredCount: prefilterResult.discarded,
          relevantCount: rerankResult.items.length,
          duplicateCount: dedupResult.duplicates,
          queuedForSendingCount: 0,
          executionTimeMs: Math.round(performance.now() - start),
          timestamp: new Date().toISOString(),
        };

        await setJson(LAST_RUN_METADATA_KEY, {
          ...result,
          status: "all_duplicates",
        });

        return result;
      }

      // Stage 5: Trigger sender tasks com delays incrementais
      metadata.set("stage", "triggering_senders");
      metadata.set("progress", 85);

      const sendDelays: number[] = [];
      let cumulativeDelay = 0;

      // Gera delays aleatórios entre 2-5 minutos para cada notícia
      // Primeira notícia envia imediatamente, próximas com delays crescentes
      for (let i = 0; i < dedupResult.items.length; i++) {
        if (i === 0) {
          sendDelays.push(0); // Primeira notícia sem delay
        } else {
          // Delay aleatório entre 2-5 minutos (em minutos)
          const randomDelay = MIN_DELAY_MINUTES + Math.random() * RANDOM_DELAY_SPAN;
          cumulativeDelay = Math.min(
            cumulativeDelay + randomDelay,
            MAX_SENDER_DELAY_MINUTES
          );
          sendDelays.push(Math.round(cumulativeDelay * 10) / 10); // Arredonda para 1 casa decimal
        }
      }

      logger.info("orchestrator.triggering_senders", {
        count: dedupResult.items.length,
        delays: sendDelays,
        maxDelayMinutes: MAX_SENDER_DELAY_MINUTES,
      });

      // Trigger todas as sender tasks em batch
      // Cada uma terá seu próprio delay configurado via wait.for()
      const batchHandle = await newsSenderTask.batchTrigger(
        dedupResult.items.map((item, index) => ({
          payload: {
            newsItem: item,
            delayMinutes: sendDelays[index],
          },
        }))
      );

      logger.info("orchestrator.senders_triggered", {
        count: dedupResult.items.length,
        batchId: batchHandle.batchId,
      });

      // Stage 6: Complete
      metadata.set("stage", "complete");
      metadata.set("progress", 100);

      const executionTimeMs = Math.round(performance.now() - start);
      const result: OrchestratorOutput = {
        discoveredCount: discovered.length,
        filteredCount: prefilterResult.discarded,
        relevantCount: rerankResult.items.length,
        duplicateCount: dedupResult.duplicates,
        queuedForSendingCount: dedupResult.items.length,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      };

      // Persiste resultado da última execução
      await setJson(LAST_RUN_METADATA_KEY, {
        ...result,
        status: "success",
        senderBatchId: batchHandle.batchId,
      });

      logger.info("orchestrator.complete", result);

      return result;
    } finally {
      await releaseLock(lock);
    }
  },
});
