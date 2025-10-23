import { describe, expect, it } from "vitest";
import { buildTelegramMessage } from "@/server/services/telegram/formatter";
import type { StructuredNewsItem } from "@/types/news";

const sample: StructuredNewsItem = {
  id: "1",
  newsId: "hash-123",
  normalizedTitle: "petrobras anuncia resultado",
  url: "https://valor.globo.com/noticia",
  title: "Petrobras anuncia resultado",
  finalTitle: "Petrobras anuncia resultado recorde",
  summary: "Resultado trimestral supera expectativas",
  bullets: ["Lucro líquido cresce 20%", "Investimentos aumentam 15%"],
  citations: [
    {
      url: "https://valor.globo.com/noticia",
      title: "Valor Econômico",
      quote: "Lucro líquido cresce 20%",
      associatedBullet: 0,
    },
    {
      url: "https://infomoney.com.br/noticia",
      title: "InfoMoney",
      quote: "Investimentos aumentam 15%",
      associatedBullet: 1,
    },
  ],
  topic: "empresas",
  tags: ["PETR4"],
  summaryForSearch: "Petrobras divulga resultados fortes",
  publishedAt: new Date().toISOString(),
  body: "Petrobras anunciou resultados positivos com lucro líquido em alta e incremento de investimentos.".repeat(2),
  source: "Valor",
  companies: ["PETR4"],
  categories: ["energia"],
  relevanceScore: 9,
  impact: "alta",
  shouldProcess: true,
};

const messageHtml = buildTelegramMessage(sample);

describe("telegram formatter", () => {
  it("builds HTML with escaped characters", () => {
    expect(messageHtml).toContain("<b>Petrobras anuncia resultado recorde</b>");
    expect(messageHtml).toContain("<a href=");
    expect(messageHtml).toContain("PETR4");
    expect(messageHtml).toContain("📌 Assunto");
    expect(messageHtml).toContain("🏷️ Tags");
  });

  it("deduplicates citations by URL", () => {
    const newsWithDuplicates: StructuredNewsItem = {
      ...sample,
      citations: [
        {
          url: "https://valor.globo.com/noticia",
          title: "Valor Econômico",
          quote: "Lucro líquido cresce 20%",
          associatedBullet: 0,
        },
        {
          url: "https://valor.globo.com/noticia", // Duplicate URL
          title: "Valor Econômico",
          quote: "Lucro líquido cresce 20%",
          associatedBullet: 1,
        },
        {
          url: "https://valor.globo.com/noticia", // Duplicate URL
          title: "Valor Econômico",
          quote: "Lucro líquido cresce 20%",
          associatedBullet: 2,
        },
      ],
    };

    const html = buildTelegramMessage(newsWithDuplicates);

    // Should only have ONE occurrence of the URL in the sources section
    const matches = html.match(/https:\/\/valor\.globo\.com\/noticia/g);
    expect(matches).toHaveLength(1);
  });
});
