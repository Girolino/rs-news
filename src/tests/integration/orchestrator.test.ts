import { describe, expect, it, vi } from "vitest";
import type { DiscoveryNewsItem, PrefilteredNewsItem, RerankedNewsItem, StructuredNewsItem, FormattedNewsItem, StoredNewsRecord } from "@/types/news";

type LockMocks = {
  acquireLock: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
};

declare global {
  var __lockMocks: LockMocks;
}

const getLockMocks = () => (globalThis as unknown as { __lockMocks: LockMocks }).__lockMocks;

vi.mock("@/server/lib/lock", () => {
  const lockMocks: LockMocks = {
    acquireLock: vi.fn(async () => ({ key: "lock", token: "token" })),
    releaseLock: vi.fn(async () => undefined),
  };
  (globalThis as unknown as { __lockMocks: LockMocks }).__lockMocks = lockMocks;
  return lockMocks;
});

const discoveryItem: DiscoveryNewsItem = {
  id: "1",
  url: "https://valor.globo.com/noticia",
  title: "Petrobras anuncia investimento",
  publishedAt: new Date().toISOString(),
  body: "Petrobras anunciou investimento relevante na B3 com impacto nas empresas do setor.",
  source: "Valor",
};

const prefilteredItem: PrefilteredNewsItem = {
  ...discoveryItem,
  newsId: "hash-1",
  normalizedTitle: "petrobras anuncia investimento",
};

const rerankedItem: RerankedNewsItem = {
  ...prefilteredItem,
  relevanceScore: 9,
  impact: "alta",
  companies: ["PETR4"],
  categories: ["energia"],
  shouldProcess: true,
};

const structuredItem: StructuredNewsItem = {
  ...rerankedItem,
  finalTitle: "Petrobras anuncia investimento",
  summary: "Investimento reforça presença da companhia no pré-sal.",
  bullets: ["Projeto aumenta produção", "Governo acompanha impacto"],
  citations: [
    {
      url: "https://valor.globo.com/noticia",
      title: "Valor Econômico",
      quote: "Projeto aumenta produção",
      associatedBullet: 0,
    },
    {
      url: "https://infomoney.com.br/noticia",
      title: "InfoMoney",
      quote: "Governo acompanha impacto",
      associatedBullet: 1,
    },
  ],
  hashtags: ["#PETR4"],
  summaryForSearch: "Investimento da Petrobras aumenta produção.",
};

const formattedItem: FormattedNewsItem = {
  ...structuredItem,
  messageHtml: "<b>Petrobras</b>",
};

const storedRecord: StoredNewsRecord = {
  ...formattedItem,
  telegramMessageId: 123,
  sentAt: new Date().toISOString(),
  failedToSend: false,
};

vi.mock("@/server/agent/stages/discovery", () => ({
  runDiscoveryStage: vi.fn(async () => [discoveryItem]),
}));

vi.mock("@/server/agent/stages/prefilter", () => ({
  runPrefilterStage: vi.fn(() => ({ items: [prefilteredItem], discarded: 0 })),
}));

vi.mock("@/server/agent/stages/rerank", () => ({
  runRerankStage: vi.fn(async () => ({ items: [rerankedItem], skipped: 0 })),
}));

vi.mock("@/server/agent/stages/dedup", () => ({
  runDedupStage: vi.fn(async () => ({ items: [rerankedItem], duplicates: 0 })),
}));

vi.mock("@/server/agent/stages/summarize", () => ({
  runSummarizeStage: vi.fn(async () => ({ items: [structuredItem], failures: 0 })),
}));

vi.mock("@/server/agent/stages/format", () => ({
  runFormatStage: vi.fn(() => [formattedItem]),
}));

vi.mock("@/server/agent/stages/send", () => ({
  runSendStage: vi.fn(async () => ({ sent: [storedRecord], failed: [] })),
}));

vi.mock("@/server/agent/stages/persist", () => ({
  runPersistStage: vi.fn(async () => undefined),
}));

vi.mock("@/server/services/storage/redis", () => ({
  setJson: vi.fn(async () => undefined),
}));

import { runNewsAgent } from "@/server/agent/orchestrator";

vi.stubGlobal("performance", {
  now: vi.fn(() => 1000),
});

describe("agent orchestrator", () => {
  it("runs full pipeline and returns metrics", async () => {
    const result = await runNewsAgent();
    expect(result.metrics.discoveredCount).toBe(1);
    expect(result.metrics.sentCount).toBe(1);
    expect(result.sentNewsIds).toEqual([storedRecord.newsId]);
    const lockMocks = getLockMocks();
    expect(lockMocks.acquireLock).toHaveBeenCalled();
    expect(lockMocks.releaseLock).toHaveBeenCalled();
  });
});
