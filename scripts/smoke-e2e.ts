/**
 * Smoke Test E2E - Pipeline Completo de Notícias
 *
 * Testa todos os 8 estágios do pipeline:
 * discovery → prefilter → rerank → dedup → summarize → format → send → persist
 */

import { config } from "dotenv";
import { runDiscoveryStage } from "@/server/agent/stages/discovery";
import { runPrefilterStage } from "@/server/agent/stages/prefilter";
import { runRerankStage } from "@/server/agent/stages/rerank";
import { runDedupStage } from "@/server/agent/stages/dedup";
import { runSummarizeStage } from "@/server/agent/stages/summarize";
import { runFormatStage } from "@/server/agent/stages/format";
import type { FormattedNewsItem, StoredNewsRecord } from "@/types/news";
import { toISOString } from "@/lib/utils";
import { storedNewsRecordSchema } from "@/types/news";

// Carrega .env.local
config({ path: ".env.local" });

// ANSI Color Codes
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function logSuccess(message: string) {
  console.log(`${COLORS.green}✅ ${message}${COLORS.reset}`);
}

function logError(message: string) {
  console.log(`${COLORS.red}❌ ${message}${COLORS.reset}`);
}

function logWarning(message: string) {
  console.log(`${COLORS.yellow}⚠️  ${message}${COLORS.reset}`);
}

function logInfo(message: string) {
  console.log(`${COLORS.blue}ℹ️  ${message}${COLORS.reset}`);
}

function logStage(stage: string) {
  console.log(
    `\n${COLORS.bright}${COLORS.magenta}━━━ ${stage.toUpperCase()} ━━━${COLORS.reset}\n`
  );
}

function logMetric(label: string, value: string | number) {
  console.log(`${COLORS.cyan}  ${label}: ${COLORS.bright}${value}${COLORS.reset}`);
}

interface StageMetrics {
  name: string;
  duration: number;
  inputCount: number;
  outputCount: number;
  success: boolean;
  error?: string;
}

// Mock do send stage (não envia de verdade)
async function mockSendStage(
  items: FormattedNewsItem[]
): Promise<{ sent: StoredNewsRecord[]; failed: StoredNewsRecord[] }> {
  logInfo("MOCK: Simulando envio ao Telegram (não enviará de verdade)");

  const sent: StoredNewsRecord[] = [];
  const failed: StoredNewsRecord[] = [];

  for (const item of items) {
    try {
      // Mock: simula sucesso de envio
      const mockMessageId = Math.floor(Math.random() * 1000000);

      const record = storedNewsRecordSchema.parse({
        ...item,
        telegramMessageId: mockMessageId,
        sentAt: toISOString(new Date()),
        failedToSend: false,
      });

      sent.push(record);
      logInfo(`  Simulado envio: ${item.finalTitle.substring(0, 50)}... (msgId: ${mockMessageId})`);
    } catch (error) {
      logWarning(`  Falha ao criar record: ${error instanceof Error ? error.message : String(error)}`);

      const record = storedNewsRecordSchema.parse({
        ...item,
        sentAt: toISOString(new Date()),
        failedToSend: true,
      });
      failed.push(record);
    }
  }

  return { sent, failed };
}

// Mock do persist stage (não persiste de verdade)
async function mockPersistStage(records: StoredNewsRecord[]): Promise<void> {
  logInfo("MOCK: Simulando persistência no Redis/Vector (não salvará de verdade)");

  for (const record of records) {
    logInfo(`  Simulado persist: newsId=${record.newsId.substring(0, 12)}... (${record.failedToSend ? 'FAILED' : 'SUCCESS'})`);
  }
}

async function main() {
  console.log(`${COLORS.bright}${COLORS.blue}`);
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║         SMOKE TEST E2E - PIPELINE COMPLETO           ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(COLORS.reset);

  const metrics: StageMetrics[] = [];
  const startTime = Date.now();

  try {
    // ━━━ STAGE 1: DISCOVERY ━━━
    logStage("Stage 1: Discovery");
    const discoveryStart = Date.now();

    let discoveredNews;
    try {
      discoveredNews = await runDiscoveryStage();
      const discoveryDuration = Date.now() - discoveryStart;

      logMetric("Duração", `${(discoveryDuration / 1000).toFixed(2)}s`);
      logMetric("Notícias encontradas", discoveredNews.length);

      if (discoveredNews.length > 0) {
        logSuccess("Discovery stage concluído com sucesso");
        metrics.push({
          name: "discovery",
          duration: discoveryDuration,
          inputCount: 0,
          outputCount: discoveredNews.length,
          success: true,
        });
      } else {
        logWarning("Discovery não retornou notícias");
        metrics.push({
          name: "discovery",
          duration: discoveryDuration,
          inputCount: 0,
          outputCount: 0,
          success: false,
          error: "No news found",
        });
        throw new Error("Discovery stage não retornou notícias");
      }
    } catch (error) {
      const discoveryDuration = Date.now() - discoveryStart;
      logError(`Discovery falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "discovery",
        duration: discoveryDuration,
        inputCount: 0,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ STAGE 2: PREFILTER ━━━
    logStage("Stage 2: Prefilter");
    const prefilterStart = Date.now();

    try {
      const prefilterResult = runPrefilterStage(discoveredNews);
      const prefilterDuration = Date.now() - prefilterStart;

      logMetric("Duração", `${(prefilterDuration / 1000).toFixed(2)}s`);
      logMetric("Input", discoveredNews.length);
      logMetric("Output", prefilterResult.items.length);
      logMetric("Descartadas", prefilterResult.discarded);

      if (prefilterResult.items.length > 0) {
        logSuccess("Prefilter stage concluído com sucesso");
        metrics.push({
          name: "prefilter",
          duration: prefilterDuration,
          inputCount: discoveredNews.length,
          outputCount: prefilterResult.items.length,
          success: true,
        });
      } else {
        logWarning("Prefilter não passou nenhuma notícia");
        metrics.push({
          name: "prefilter",
          duration: prefilterDuration,
          inputCount: discoveredNews.length,
          outputCount: 0,
          success: false,
          error: "No news passed prefilter",
        });
        throw new Error("Prefilter stage não passou nenhuma notícia");
      }

      var prefilteredNews = prefilterResult.items;
    } catch (error) {
      const prefilterDuration = Date.now() - prefilterStart;
      logError(`Prefilter falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "prefilter",
        duration: prefilterDuration,
        inputCount: discoveredNews.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ STAGE 3: RERANK ━━━
    logStage("Stage 3: Rerank");
    const rerankStart = Date.now();

    try {
      const rerankResult = await runRerankStage(prefilteredNews);
      const rerankDuration = Date.now() - rerankStart;

      logMetric("Duração", `${(rerankDuration / 1000).toFixed(2)}s`);
      logMetric("Input", prefilteredNews.length);
      logMetric("Output", rerankResult.items.length);
      logMetric("Skipped", rerankResult.skipped);

      if (rerankResult.items.length > 0) {
        logSuccess("Rerank stage concluído com sucesso");
        metrics.push({
          name: "rerank",
          duration: rerankDuration,
          inputCount: prefilteredNews.length,
          outputCount: rerankResult.items.length,
          success: true,
        });

        // Mostra scores
        rerankResult.items.forEach((item, i) => {
          logInfo(`  ${i + 1}. [${item.relevanceScore}/10] ${item.title.substring(0, 60)}...`);
        });
      } else {
        logWarning("Rerank não passou nenhuma notícia");
        metrics.push({
          name: "rerank",
          duration: rerankDuration,
          inputCount: prefilteredNews.length,
          outputCount: 0,
          success: false,
          error: "No news passed rerank",
        });
        throw new Error("Rerank stage não passou nenhuma notícia");
      }

      var rerankedNews = rerankResult.items;
    } catch (error) {
      const rerankDuration = Date.now() - rerankStart;
      logError(`Rerank falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "rerank",
        duration: rerankDuration,
        inputCount: prefilteredNews.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ STAGE 4: DEDUP ━━━
    logStage("Stage 4: Dedup");
    const dedupStart = Date.now();

    try {
      const dedupResult = await runDedupStage(rerankedNews);
      const dedupDuration = Date.now() - dedupStart;

      logMetric("Duração", `${(dedupDuration / 1000).toFixed(2)}s`);
      logMetric("Input", rerankedNews.length);
      logMetric("Output", dedupResult.items.length);
      logMetric("Duplicatas", dedupResult.duplicates);

      logSuccess("Dedup stage concluído com sucesso");
      metrics.push({
        name: "dedup",
        duration: dedupDuration,
        inputCount: rerankedNews.length,
        outputCount: dedupResult.items.length,
        success: true,
      });

      var dedupedNews = dedupResult.items;
    } catch (error) {
      const dedupDuration = Date.now() - dedupStart;
      logError(`Dedup falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "dedup",
        duration: dedupDuration,
        inputCount: rerankedNews.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Se não sobrou nenhuma notícia após dedup, continua mesmo assim para testar os próximos estágios
    if (dedupedNews.length === 0) {
      logWarning("Dedup não deixou nenhuma notícia passar (todas eram duplicatas)");
      logInfo("Usando apenas a primeira notícia reranked para continuar o teste...");
      dedupedNews = rerankedNews.slice(0, 1);
    }

    // ━━━ STAGE 5: SUMMARIZE ━━━
    logStage("Stage 5: Summarize");
    const summarizeStart = Date.now();

    try {
      const summarizeResult = await runSummarizeStage(dedupedNews);
      const summarizeDuration = Date.now() - summarizeStart;

      logMetric("Duração", `${(summarizeDuration / 1000).toFixed(2)}s`);
      logMetric("Input", dedupedNews.length);
      logMetric("Output", summarizeResult.items.length);
      logMetric("Failures", summarizeResult.failures);

      if (summarizeResult.items.length > 0) {
        logSuccess("Summarize stage concluído com sucesso");
        metrics.push({
          name: "summarize",
          duration: summarizeDuration,
          inputCount: dedupedNews.length,
          outputCount: summarizeResult.items.length,
          success: true,
        });

        // Mostra resumos
        summarizeResult.items.forEach((item, i) => {
          logInfo(`  ${i + 1}. ${item.finalTitle}`);
          logInfo(`     Resumo: ${item.summary.substring(0, 80)}...`);
          logInfo(`     Bullets: ${item.bullets.length}, Citations: ${item.citations.length}, Hashtags: ${item.hashtags.join(' ')}`);
        });
      } else {
        logWarning("Summarize não gerou nenhum resumo");
        metrics.push({
          name: "summarize",
          duration: summarizeDuration,
          inputCount: dedupedNews.length,
          outputCount: 0,
          success: false,
          error: "No summaries generated",
        });
        throw new Error("Summarize stage não gerou nenhum resumo");
      }

      var summarizedNews = summarizeResult.items;
    } catch (error) {
      const summarizeDuration = Date.now() - summarizeStart;
      logError(`Summarize falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "summarize",
        duration: summarizeDuration,
        inputCount: dedupedNews.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ STAGE 6: FORMAT ━━━
    logStage("Stage 6: Format");
    const formatStart = Date.now();

    try {
      const formattedNews = runFormatStage(summarizedNews);
      const formatDuration = Date.now() - formatStart;

      logMetric("Duração", `${(formatDuration / 1000).toFixed(2)}s`);
      logMetric("Input", summarizedNews.length);
      logMetric("Output", formattedNews.length);

      logSuccess("Format stage concluído com sucesso");
      metrics.push({
        name: "format",
        duration: formatDuration,
        inputCount: summarizedNews.length,
        outputCount: formattedNews.length,
        success: true,
      });

      // Valida HTML
      formattedNews.forEach((item, i) => {
        if (item.messageHtml.length > 4096) {
          logWarning(`  Mensagem ${i + 1} excede 4096 chars: ${item.messageHtml.length} chars`);
        } else {
          logInfo(`  Mensagem ${i + 1}: ${item.messageHtml.length} chars ✓`);
        }
      });

      var finalFormattedNews = formattedNews;
    } catch (error) {
      const formatDuration = Date.now() - formatStart;
      logError(`Format falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "format",
        duration: formatDuration,
        inputCount: summarizedNews.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ STAGE 7: SEND (MOCK) ━━━
    logStage("Stage 7: Send (MOCK)");
    const sendStart = Date.now();

    try {
      const sendResult = await mockSendStage(finalFormattedNews);
      const sendDuration = Date.now() - sendStart;

      logMetric("Duração", `${(sendDuration / 1000).toFixed(2)}s`);
      logMetric("Input", finalFormattedNews.length);
      logMetric("Sent", sendResult.sent.length);
      logMetric("Failed", sendResult.failed.length);

      logSuccess("Send stage (mock) concluído com sucesso");
      metrics.push({
        name: "send",
        duration: sendDuration,
        inputCount: finalFormattedNews.length,
        outputCount: sendResult.sent.length,
        success: true,
      });

      var allRecords = [...sendResult.sent, ...sendResult.failed];
    } catch (error) {
      const sendDuration = Date.now() - sendStart;
      logError(`Send falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "send",
        duration: sendDuration,
        inputCount: finalFormattedNews.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ STAGE 8: PERSIST (MOCK) ━━━
    logStage("Stage 8: Persist (MOCK)");
    const persistStart = Date.now();

    try {
      await mockPersistStage(allRecords);
      const persistDuration = Date.now() - persistStart;

      logMetric("Duração", `${(persistDuration / 1000).toFixed(2)}s`);
      logMetric("Records", allRecords.length);

      logSuccess("Persist stage (mock) concluído com sucesso");
      metrics.push({
        name: "persist",
        duration: persistDuration,
        inputCount: allRecords.length,
        outputCount: allRecords.length,
        success: true,
      });
    } catch (error) {
      const persistDuration = Date.now() - persistStart;
      logError(`Persist falhou: ${error instanceof Error ? error.message : String(error)}`);
      metrics.push({
        name: "persist",
        duration: persistDuration,
        inputCount: allRecords.length,
        outputCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // ━━━ RELATÓRIO FINAL ━━━
    const totalDuration = Date.now() - startTime;

    console.log(`\n${COLORS.bright}${COLORS.blue}`);
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║              RELATÓRIO FINAL - MÉTRICAS              ║");
    console.log("╚═══════════════════════════════════════════════════════╝");
    console.log(COLORS.reset);

    console.log("\n📊 Métricas por Estágio:\n");

    metrics.forEach((metric) => {
      const status = metric.success ? `${COLORS.green}✅ SUCESSO${COLORS.reset}` : `${COLORS.red}❌ FALHA${COLORS.reset}`;
      console.log(`${COLORS.bright}${metric.name.toUpperCase()}${COLORS.reset} - ${status}`);
      console.log(`  Duração: ${(metric.duration / 1000).toFixed(2)}s`);
      console.log(`  Input: ${metric.inputCount} | Output: ${metric.outputCount}`);
      if (metric.error) {
        console.log(`  ${COLORS.red}Erro: ${metric.error}${COLORS.reset}`);
      }
      console.log();
    });

    console.log(`${COLORS.bright}PIPELINE COMPLETO${COLORS.reset}`);
    console.log(`  Duração total: ${COLORS.bright}${(totalDuration / 1000).toFixed(2)}s${COLORS.reset}`);
    console.log(`  Estágios completados: ${COLORS.bright}${metrics.filter(m => m.success).length}/${metrics.length}${COLORS.reset}`);
    console.log(`  Taxa de sucesso: ${COLORS.bright}${((metrics.filter(m => m.success).length / metrics.length) * 100).toFixed(1)}%${COLORS.reset}`);

    // Retorna JSON para parsing
    console.log("\n📋 JSON Result:");
    console.log(JSON.stringify({
      success: metrics.every(m => m.success),
      totalDurationSeconds: (totalDuration / 1000).toFixed(2),
      stages: metrics,
      finalNewsCount: allRecords.length,
    }, null, 2));

    if (!metrics.every(m => m.success)) {
      process.exitCode = 1;
    }

  } catch (error) {
    logError(`Pipeline falhou: ${error instanceof Error ? error.message : String(error)}`);

    console.log("\n📋 JSON Result:");
    console.log(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stages: metrics,
    }, null, 2));

    process.exitCode = 1;
  }
}

main();
