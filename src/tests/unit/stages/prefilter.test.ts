import { describe, expect, it } from "vitest";
import { runPrefilterStage } from "@/server/agent/stages/prefilter";
import type { DiscoveryNewsItem } from "@/types/news";

const baseItem: DiscoveryNewsItem = {
  id: "1",
  url: "https://valor.globo.com/noticia/1",
  title: "Petrobras anuncia novo investimento",
  publishedAt: new Date("2025-10-21T10:00:00Z").toISOString(),
  body: "Petrobras anunciou novo investimento na B3 com impacto relevante no mercado brasileiro. O comunicado destaca detalhes financeiros, projeções e implicações para a economia local, reforçando expectativas positivas.".repeat(2),
  source: "valor.globo.com",
};

describe("prefilter stage", () => {
  it("filters out non-compliant articles and keeps valid ones", () => {
    const now = new Date("2025-10-21T12:00:00Z");
    const items: DiscoveryNewsItem[] = [
      baseItem,
      {
        ...baseItem,
        id: "2",
        url: "https://example.com/english",
        title: "Foreign company reports earnings",
        body: "This article is entirely in English without portuguese stopwords.".repeat(3),
      },
      {
        ...baseItem,
        id: "3",
        url: "https://valor.globo.com/old",
        publishedAt: new Date("2025-10-19T08:00:00Z").toISOString(),
      },
      {
        ...baseItem,
        id: "4",
        url: "https://valor.globo.com/short",
        body: "Texto curto",
      },
      {
        ...baseItem,
        id: "5",
        url: baseItem.url,
      },
    ];

    const result = runPrefilterStage(items, now);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("1");
    expect(result.discarded).toBe(items.length - 1);
  });

  it("discards items sem keywords econômicas", () => {
    const now = new Date("2025-10-21T12:00:00Z");
    const items: DiscoveryNewsItem[] = [
      {
        ...baseItem,
        id: "clean",
        title: "Festival cultural regional",
        body: "Matéria cultural sobre festival regional com atrações artísticas.".repeat(3),
      },
    ];

    const result = runPrefilterStage(items, now);
    expect(result.items).toHaveLength(0);
    expect(result.discarded).toBe(1);
  });
});
