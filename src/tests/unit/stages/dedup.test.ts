import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RerankedNewsItem } from "@/types/news";

const searchMock = vi.fn();

vi.mock("@/config/env", () => ({
  loadEnv: () => ({
    DEDUP_SIMILARITY_THRESHOLD: "0.9",
    DEDUP_SIMHASH_DISTANCE_THRESHOLD: "12",
  }),
  getNumericEnv: (value: string | undefined, fallback: number) =>
    value ? Number(value) : fallback,
}));

vi.mock("@/server/services/storage/search", () => ({
  searchIndex: vi.fn(() => ({
    search: (...args: unknown[]) => searchMock(...args),
  })),
}));

import { runDedupStage } from "@/server/agent/stages/dedup";
import { buildFingerprintText, computeFingerprint, fingerprintToHex } from "@/server/lib/fingerprint";

const baseItem: RerankedNewsItem = {
  id: "1",
  newsId: "hash-1",
  normalizedTitle: "petrobras anuncia resultado",
  url: "https://valor.globo.com/noticia",
  title: "Petrobras anuncia resultado",
  companies: ["PETR4"],
  categories: ["energia"],
  publishedAt: new Date().toISOString(),
  body: "Petrobras anunciou investimento.",
  source: "Valor",
  relevanceScore: 9,
  impact: "alta",
  shouldProcess: true,
};

describe("dedup stage", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it("filters out duplicates based on score", async () => {
    searchMock.mockResolvedValueOnce([
      {
        id: "existing",
        content: { text: "" },
        metadata: {},
        score: 0.95,
      },
    ]);

    const result = await runDedupStage([baseItem]);
    expect(result.items).toHaveLength(0);
    expect(result.duplicates).toBe(1);
  });

  it("allows unique items", async () => {
    searchMock.mockResolvedValueOnce([
      {
        id: "existing",
        content: { text: "" },
        metadata: {},
        score: 0.2,
      },
    ]);

    const result = await runDedupStage([baseItem]);
    expect(result.items).toHaveLength(1);
    expect(result.duplicates).toBe(0);
  });

  it("filters out duplicates based on simhash distance", async () => {
    const fingerprintText = buildFingerprintText({
      title: baseItem.normalizedTitle,
      body: baseItem.body,
    });
    const fingerprint = computeFingerprint(fingerprintText);
    if (!fingerprint) {
      throw new Error("Fingerprint not generated");
    }
    searchMock.mockResolvedValueOnce([
      {
        id: "existing",
        content: { text: "" },
        metadata: {
          bodyFingerprint: fingerprintToHex(fingerprint),
        },
        score: 0.2,
      },
    ]);

    const result = await runDedupStage([baseItem]);
    expect(result.items).toHaveLength(0);
    expect(result.duplicates).toBe(1);
  });
});
