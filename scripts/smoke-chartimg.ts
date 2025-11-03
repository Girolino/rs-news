import { config } from "dotenv";
import { getChartImage } from "@/server/services/market/chartImg";

config({ path: ".env.local" });

async function main() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║      SMOKE TEST CHART-IMG API             ║");
  console.log("╚════════════════════════════════════════════╝\n");

  const result = await getChartImage({ ticker: "PETR4" });

  if (!result) {
    throw new Error("Falha ao obter gráfico Chart-IMG. Verifique chave e limites.");
  }

  console.log("✅ Chart-IMG respondeu com sucesso");
  console.log(`URL: ${result.url}`);
  console.log(`Intervalo: ${result.interval}`);
  console.log(`Range: ${result.range}`);
}

main().catch((error) => {
  console.error("❌ Falha no smoke-chartimg", error);
  process.exitCode = 1;
});
