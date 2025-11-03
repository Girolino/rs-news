import { schedules } from "@trigger.dev/sdk";
import { loadEnv } from "@/config/env";
import { redis } from "@/server/services/storage/redis";
import { sendTelegramMessage } from "@/server/services/telegram/client";
import { logger } from "@/server/lib/logger";
import type { OrchestratorOutput } from "./types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function formatDateBRT(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export const newsDailyReportTask = schedules.task({
  id: "news-daily-report",
  cron: {
    pattern: "0 20 * * 1-5",
    timezone: "America/Sao_Paulo",
  },
  retry: {
    maxAttempts: 2,
  },
  run: async () => {
    const env = loadEnv();
    if (!env.TELEGRAM_ADMIN_CHAT_ID) {
      logger.warn("monitoring.daily_report.skipped", {
        reason: "missing_admin_chat_id",
      });
      return;
    }

    const client = redis();
    const entries = await client.lrange<string>("agent:news:runs", 0, 49);

    if (!entries || entries.length === 0) {
      logger.info("monitoring.daily_report.no_history");
      return;
    }

    const now = Date.now();
    const cutoff = now - ONE_DAY_MS;

    const runs: OrchestratorOutput[] = entries
      .map((entry) => {
        try {
          return JSON.parse(entry) as OrchestratorOutput;
        } catch {
          return null;
        }
      })
      .filter((run): run is OrchestratorOutput => Boolean(run))
      .filter((run) => {
        const timestamp = new Date(run.timestamp).getTime();
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      });

    if (runs.length === 0) {
      logger.info("monitoring.daily_report.no_recent_runs");
      return;
    }

    const totalDiscovered = runs.reduce(
      (acc, run) => acc + run.discoveredCount,
      0,
    );
    const totalSent = runs.reduce(
      (acc, run) => acc + run.queuedForSendingCount,
      0,
    );
    const totalDuplicates = runs.reduce(
      (acc, run) => acc + run.duplicateCount,
      0,
    );

    const channelAggregate = new Map<
      string,
      { queued: number; discovered: number; status: Record<string, number> }
    >();

    for (const run of runs) {
      for (const channel of run.channels) {
        const entry = channelAggregate.get(channel.channelId) ?? {
          queued: 0,
          discovered: 0,
          status: {},
        };
        entry.queued += channel.queuedForSendingCount;
        entry.discovered += channel.discoveredCount;
        entry.status[channel.status] = (entry.status[channel.status] ?? 0) + 1;
        channelAggregate.set(channel.channelId, entry);
      }
    }

    const lines: string[] = [];
    lines.push(
      `📊 <b>Relatório diário RS News</b> (${formatDateBRT(new Date())})`,
    );
    lines.push(`• Execuções: ${runs.length}`);
    lines.push(`• Descobertas: ${totalDiscovered}`);
    lines.push(`• Enviadas: ${totalSent}`);
    lines.push(`• Duplicatas filtradas: ${totalDuplicates}`);
    lines.push("\n<b>Canais</b>");

    for (const [channelId, data] of channelAggregate.entries()) {
      const statusSummary = Object.entries(data.status)
        .map(([status, count]) => `${status}(${count})`)
        .join(", ");
      lines.push(
        `• ${channelId}: ${data.queued} enviadas / ${data.discovered} descobertas — ${statusSummary}`,
      );
    }

    await sendTelegramMessage({
      chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  },
});
