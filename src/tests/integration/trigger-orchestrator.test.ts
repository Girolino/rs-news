import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  DiscoveryNewsItem,
  PrefilteredNewsItem,
  RerankedNewsItem,
} from "@/types/news";

let randomSpy: any;
let perfSpy: any;

const triggerMocks = vi.hoisted(() => {
  const metadata = {
    set: vi.fn(),
    increment: vi.fn(),
    append: vi.fn(),
    parent: {
      set: vi.fn(),
      increment: vi.fn(),
      append: vi.fn(),
    },
    root: {
      increment: vi.fn(),
    },
  };

  const schedules = {
    task: vi.fn((config: unknown) => config),
  };

  const wait = {
    for: vi.fn(async () => undefined),
  };

  const queue = vi.fn(() => ({}));

  const task = vi.fn((config: unknown) => config);

  return { metadata, schedules, wait, queue, task };
});

vi.mock("@trigger.dev/sdk", () => triggerMocks);

const {
  acquireLockMock,
  releaseLockMock,
  discoveryItem,
  prefilteredItem,
  rerankedItem,
  batchTriggerMock,
} = vi.hoisted(() => {
  const discovery: DiscoveryNewsItem = {
    id: "1",
    url: "https://valor.globo.com/noticia",
    title: "Petrobras anuncia investimento",
    publishedAt: new Date().toISOString(),
    body: "Petrobras anunciou investimento relevante na B3 com impacto setorial.",
    source: "Valor",
  };

  const prefiltered: PrefilteredNewsItem = {
    ...discovery,
    newsId: "hash-1",
    normalizedTitle: "petrobras anuncia investimento",
  };

  const reranked: RerankedNewsItem = {
    ...prefiltered,
    relevanceScore: 9,
    impact: "alta",
    companies: ["PETR4"],
    categories: ["energia"],
    shouldProcess: true,
  };

  return {
    acquireLockMock: vi.fn(async () => ({ key: "lock", token: "token" })),
    releaseLockMock: vi.fn(async () => undefined),
    discoveryItem: discovery,
    prefilteredItem: prefiltered,
    rerankedItem: reranked,
    batchTriggerMock: vi.fn(async () => ({ batchId: "batch-default" })),
  };
});

vi.mock("@/server/lib/lock", () => ({
  acquireLock: acquireLockMock,
  releaseLock: releaseLockMock,
}));

vi.mock("@/config/channels", () => ({
  CHANNELS: [
    {
      id: "default",
      label: "Canal Principal",
      chatId: "chat-default",
    },
    {
      id: "filtered",
      label: "Canal Filtrado",
      chatId: "chat-filtered",
      filters: {
        allowedTickers: ["XPTO3"],
      },
    },
  ],
}));

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

vi.mock("@/server/services/storage/redis", () => ({
  setJson: vi.fn(async () => undefined),
}));

vi.mock("trigger/sender.task", () => ({
  newsSenderTask: {
    batchTrigger: batchTriggerMock,
  },
}));

import { CHANNELS } from "@/config/channels";
import { processChannel } from "trigger/orchestrator.task";

describe("newsOrchestratorTask", () => {
  beforeEach(() => {
    acquireLockMock.mockClear();
    releaseLockMock.mockClear();
    batchTriggerMock.mockClear();
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    perfSpy = vi.spyOn(performance, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    randomSpy?.mockRestore();
    perfSpy?.mockRestore();
  });

  it("processes multiple channels and respects filters", async () => {
    const channelResults = [];
    for (const channel of CHANNELS) {
      const result = await processChannel(channel);
      channelResults.push(result);
    }

    expect(channelResults).toHaveLength(2);

    const defaultChannel = channelResults.find(
      (channel) => channel.channelId === "default",
    );
    const filteredChannel = channelResults.find(
      (channel) => channel.channelId === "filtered",
    );

    expect(defaultChannel).toMatchObject({
      discoveredCount: 1,
      queuedForSendingCount: 1,
      status: "success",
      senderBatchId: "batch-default",
    });

    expect(filteredChannel).toMatchObject({
      discoveredCount: 1,
      queuedForSendingCount: 0,
      status: "filtered_by_channel",
    });

    expect(batchTriggerMock).toHaveBeenCalledTimes(1);
    const firstCall = batchTriggerMock.mock.calls[0] as any[] | undefined;
    const triggerArgs = firstCall?.[0] as any[] | undefined;
    const firstPayload = triggerArgs?.[0];
    expect(firstPayload?.payload.channel).toEqual({
      id: "default",
      chatId: "chat-default",
      features: undefined,
    });
  });
});
