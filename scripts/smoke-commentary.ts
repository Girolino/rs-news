import { config } from "dotenv";
import { runCommentaryStage } from "@/server/agent/stages/commentary";
import type { StructuredNewsItem } from "@/types/news";

config({ path: ".env.local" });

const sampleItem: StructuredNewsItem = {
  id: "sample-1",
  newsId: "sample-1",
  url: "https://valor.globo.com/noticia",
  title: "Banco Central sinaliza manutenção da Selic",
  normalizedTitle: "banco central sinaliza manutencao da selic",
  finalTitle: "BC indica Selic estável com inflação resiliente",
  summary: "Comunicação reforça postura vigilante diante de inflação de serviços persistente.",
  publishedAt: new Date().toISOString(),
  body: "O Comitê de Política Monetária do Banco Central sinalizou, na ata da reunião de novembro, que a Selic deve permanecer estável nas próximas decisões diante da resiliência da inflação de serviços.",
  source: "Valor",
  relevanceScore: 8,
  impact: "média",
  shouldProcess: true,
  summaryForSearch: "BC indica Selic estável com inflação resiliente",
  companies: [],
  categories: ["macro"],
  topic: "economia",
  tags: [],
  bullets: [
    "Copom aponta inflação de serviços resiliente como obstáculo para novos cortes.",
    "Expectativa de Selic estável reforça busca por prefixados mais longos.",
  ],
  citations: [
    {
      url: "https://valor.globo.com/noticia",
      title: "Valor Econômico",
      quote: "Copom destaca resiliência da inflação de serviços.",
      associatedBullet: 0,
    },
  ],
};

async function main() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║      SMOKE TEST COMMENTARY (AI)           ║");
  console.log("╚════════════════════════════════════════════╝\n");

  const commentary = await runCommentaryStage(sampleItem);

  if (!commentary) {
    throw new Error("Comentário não gerado. Verifique logs do estágio commentary.");
  }

  console.log("✅ Comentário gerado com sucesso");
  console.log(`Comprimento: ${commentary.length} caracteres`);
  console.log("\nPré-visualização:");
  console.log(commentary);
}

main().catch((error) => {
  console.error("❌ Falha no smoke commentary");
  console.error(error);
  process.exitCode = 1;
});
