export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 py-24 text-slate-900">
      <h1 className="text-4xl font-semibold">RS News Agent</h1>
      <p className="max-w-xl text-center text-lg text-slate-600">
        Monitoramento automatizado das principais notícias econômicas e corporativas
        do mercado brasileiro. Utilize os endpoints tRPC ou o cron job em Vercel para
        disparar o pipeline completo.
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-medium">Endpoints</h2>
        <ul className="mt-4 space-y-2 text-left text-slate-700">
          <li>
            <code className="rounded bg-slate-100 px-2 py-1 text-sm">POST /api/cron/news-agent</code>
            <span className="ml-2">— dispara o pipeline via cron ou manualmente</span>
          </li>
          <li>
            <code className="rounded bg-slate-100 px-2 py-1 text-sm">POST /api/admin/retry-failed</code>
            <span className="ml-2">— reenfileira envios que falharam</span>
          </li>
          <li>
            <code className="rounded bg-slate-100 px-2 py-1 text-sm">tRPC news.runAgent</code>
            <span className="ml-2">— executa o pipeline sob demanda</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
