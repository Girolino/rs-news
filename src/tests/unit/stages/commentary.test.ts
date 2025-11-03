import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StructuredNewsItem } from "@/types/news";

const runGenerateObjectMock = vi.fn();

vi.mock("@/server/services/ai/gateway", () => ({
  runGenerateObject: (...args: unknown[]) => runGenerateObjectMock(...args),
}));

vi.mock("@/lib/ai/models", () => ({
  getModelName: () => "gpt-5-mini",
}));

import { runCommentaryStage } from "@/server/agent/stages/commentary";

const baseStructured: StructuredNewsItem = {
  id: "1",
  newsId: "hash-1",
  normalizedTitle: "petrobras anuncia resultado",
  url: "https://valor.globo.com/noticia",
  title: "Petrobras anuncia resultado",
  finalTitle: "Petrobras divulga lucro recorde",
  summary: "Lucro líquido supera estimativas e reforça guidance de 2025.",
  publishedAt: new Date().toISOString(),
  body: "Petrobras anunciou lucro líquido recorde impulsionado por alta do petróleo.",
  source: "Valor",
  relevanceScore: 9,
  impact: "alta",
  shouldProcess: true,
  summaryForSearch: "Lucro recorde da Petro",
  companies: ["PETR4"],
  categories: ["energia"],
  topic: "empresas",
  tags: ["PETR4"],
  bullets: [
    "Lucro líquido sobe 25% vs. 3T24 com Brent acima de US$90",
    "Companhia mantém guidance de investimentos em R$ 73 bi",
  ],
  citations: [
    {
      url: "https://valor.globo.com/noticia",
      title: "Valor",
      quote: "Lucro líquido cresce 25%",
      associatedBullet: 0,
    },
  ],
};

describe("runCommentaryStage", () => {
  beforeEach(() => {
    runGenerateObjectMock.mockReset();
  });

  it("returns commentary text on success", async () => {
    runGenerateObjectMock.mockResolvedValueOnce({
      commentary: "Alta reforça apetite por dividendos, mas execução segue foco.",
    });

    const result = await runCommentaryStage(baseStructured);

    expect(result).toBe(
      "Alta reforça apetite por dividendos, mas execução segue foco.",
    );
    expect(runGenerateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when gateway throws", async () => {
    runGenerateObjectMock.mockRejectedValueOnce(new Error("gateway-error"));

    const result = await runCommentaryStage(baseStructured);

    expect(result).toBeNull();
  });
});
