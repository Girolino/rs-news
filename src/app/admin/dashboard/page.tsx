import { loadEnv } from "@/config/env";
import { redis } from "@/server/services/storage/redis";
import type { OrchestratorOutput } from "trigger/types";
import { notFound } from "next/navigation";

const LAST_RUN_METADATA_KEY = "agent:news:last_run";

type DashboardData = {
  lastRun: OrchestratorOutput | null;
  recentRuns: OrchestratorOutput[];
};

type DashboardPageProps = {
  searchParams: { token?: string };
};

export function DashboardContent({ data }: { data: DashboardData }) {
  const { lastRun, recentRuns } = data;

  if (!lastRun) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Dashboard RS News</h1>
        <p>Nenhuma execução registrada ainda.</p>
      </div>
    );
  }

  const lastRunDate = new Date(lastRun.timestamp).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold">Dashboard RS News</h1>
        <p className="text-sm text-gray-600">Última execução: {lastRunDate}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Resumo (última execução)</h2>
        <ul className="list-disc list-inside">
          <li>Descobertas: {lastRun.discoveredCount}</li>
          <li>Relevantes: {lastRun.relevantCount}</li>
          <li>Duplicatas descartadas: {lastRun.duplicateCount}</li>
          <li>Enviadas: {lastRun.queuedForSendingCount}</li>
          <li>Duração: {lastRun.executionTimeMs} ms</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Canais</h2>
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-3 py-2 text-left">Canal</th>
              <th className="border px-3 py-2 text-left">Descobertas</th>
              <th className="border px-3 py-2 text-left">Enviadas</th>
              <th className="border px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {lastRun.channels.map(
              (channel: OrchestratorOutput["channels"][number]) => (
                <tr key={channel.channelId}>
                  <td className="border px-3 py-2">{channel.channelId}</td>
                  <td className="border px-3 py-2">{channel.discoveredCount}</td>
                  <td className="border px-3 py-2">{channel.queuedForSendingCount}</td>
                  <td className="border px-3 py-2">{channel.status}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Execuções recentes</h2>
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-3 py-2 text-left">Data</th>
              <th className="border px-3 py-2 text-left">Descobertas</th>
              <th className="border px-3 py-2 text-left">Enviadas</th>
              <th className="border px-3 py-2 text-left">Status canais</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((run) => (
              <tr key={run.timestamp}>
                <td className="border px-3 py-2">
                  {new Date(run.timestamp).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </td>
                <td className="border px-3 py-2">{run.discoveredCount}</td>
                <td className="border px-3 py-2">{run.queuedForSendingCount}</td>
                <td className="border px-3 py-2">
                  {run.channels
                    .map(
                      (channel: OrchestratorOutput["channels"][number]) =>
                        `${channel.channelId}: ${channel.status}`,
                    )
                    .join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const env = loadEnv();

  if (!env.ADMIN_DASHBOARD_TOKEN) {
    notFound();
  }

  if (searchParams.token !== env.ADMIN_DASHBOARD_TOKEN) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Dashboard RS News</h1>
        <p>Token inválido ou ausente.</p>
      </div>
    );
  }

  const client = redis();
  const lastRunRaw = await client.get<string>(LAST_RUN_METADATA_KEY);
  const recentRaw = await client.lrange<string>("agent:news:runs", 0, 9);

  const lastRun = lastRunRaw ? (JSON.parse(lastRunRaw) as OrchestratorOutput) : null;
  const recentRuns = (recentRaw ?? [])
    .map((entry) => {
      try {
        return JSON.parse(entry) as OrchestratorOutput;
      } catch {
        return null;
      }
    })
    .filter((run): run is OrchestratorOutput => Boolean(run));

  return <DashboardContent data={{ lastRun, recentRuns }} />;
}
