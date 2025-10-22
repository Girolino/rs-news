import { config } from "dotenv";
import { runDiscoveryStage } from "@/server/agent/stages/discovery";

// Carrega .env.local explicitamente
config({ path: ".env.local" });

async function main() {
  console.log("🔍 Testando Discovery Stage com Web Search...\n");

  const startTime = Date.now();
  const news = await runDiscoveryStage();
  const duration = Date.now() - startTime;

  console.log("\n✅ Discovery Stage completo!");
  console.log(`⏱️  Duração: ${(duration / 1000).toFixed(2)}s`);
  console.log(`📰 Notícias encontradas: ${news.length}\n`);

  if (news.length > 0) {
    console.log("--- Primeiras 5 notícias ---\n");
    news.slice(0, 5).forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   URL: ${item.url}`);
      console.log(`   Fonte: ${item.source}`);
      console.log(`   Publicado: ${item.publishedAt}`);
      console.log(`   Body: ${item.body.substring(0, 100)}...`);
      console.log();
    });
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        count: news.length,
        durationSeconds: (duration / 1000).toFixed(2),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
