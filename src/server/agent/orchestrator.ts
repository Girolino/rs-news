import { performance } from "node:perf_hooks";
import { acquireLock, releaseLock } from "@/server/lib/lock";
import { logger } from "@/server/lib/logger";
import { runDiscoveryStage } from "@/server/agent/stages/discovery";
import { runPrefilterStage } from "@/server/agent/stages/prefilter";
import { runRerankStage } from "@/server/agent/stages/rerank";
import { runDedupStage } from "@/server/agent/stages/dedup";
import { runSummarizeStage } from "@/server/agent/stages/summarize";
import { runFormatStage } from "@/server/agent/stages/format";
import { runSendStage } from "@/server/agent/stages/send";
import { runPersistStage } from "@/server/agent/stages/persist";
import { setJson } from "@/server/services/storage/redis";
import { agentResultSchema, type AgentResult, agentMetricsSchema } from "@/types/agent";

const LOCK_KEY = "cron:news:lock";
const LOCK_TTL_SECONDS = 600;
const LAST_RUN_METADATA_KEY = "agent:news:last_run";

export class AgentAlreadyRunningError extends Error {
  constructor() {
    super("News agent is already running");
  }
}

export async function runNewsAgent(): Promise<AgentResult> {
  const start = performance.now();
  const lock = await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
  if (!lock) {
    logger.warn("agent.lock.exists", {});
    throw new AgentAlreadyRunningError();
  }

  try {
    const discovered = await runDiscoveryStage();
    const prefilterResult = runPrefilterStage(discovered);
    const rerankResult = await runRerankStage(prefilterResult.items);
    const dedupResult = await runDedupStage(rerankResult.items);
    const summarizeResult = await runSummarizeStage(dedupResult.items);
    const formatted = runFormatStage(summarizeResult.items);
    const sendResult = await runSendStage(formatted);
    await runPersistStage([...sendResult.sent, ...sendResult.failed]);

    const executionTimeMs = Math.round(performance.now() - start);

    const metrics = agentMetricsSchema.parse({
      discoveredCount: discovered.length,
      filteredCount: prefilterResult.discarded,
      relevantCount: rerankResult.items.length,
      duplicateCount: dedupResult.duplicates,
      sentCount: sendResult.sent.length,
      failedCount: sendResult.failed.length,
      skippedCount:
        prefilterResult.discarded +
        rerankResult.skipped +
        dedupResult.duplicates +
        summarizeResult.failures,
      executionTimeMs,
    });

    const result = agentResultSchema.parse({
      metrics,
      sentNewsIds: sendResult.sent.map((item) => item.newsId),
    });

    await setJson(LAST_RUN_METADATA_KEY, {
      ...result,
      timestamp: new Date().toISOString(),
    });

    logger.info("agent.run.complete", result.metrics);
    return result;
  } finally {
    await releaseLock(lock);
  }
}
