import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cache,
  quotaStore,
  getJsonMock,
  setJsonMock,
  redisMock,
  fetchMock,
} = vi.hoisted(() => {
  const cache = new Map<string, unknown>();
  const quotaStore = new Map<string, number>();

  const getJsonMock = vi.fn(async (key: string) => (cache.get(key) as unknown) ?? null);
  const setJsonMock = vi.fn(async (key: string, value: unknown) => {
    cache.set(key, value);
  });

  const redisMock = {
    get: vi.fn(async (key: string) => {
      const value = quotaStore.get(key);
      return typeof value === "number" ? String(value) : null;
    }),
    incr: vi.fn(async (key: string) => {
      const next = (quotaStore.get(key) ?? 0) + 1;
      quotaStore.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => {}),
  };

  const fetchMock = vi.fn();

  return {
    cache,
    quotaStore,
    getJsonMock,
    setJsonMock,
    redisMock,
    fetchMock,
  };
});

vi.mock("@/config/env", () => ({
  loadEnv: () => ({
    CHARTIMG_SECRET_KEY: "test-key",
    CHARTIMG_DEFAULT_RANGE: "1M",
    CHARTIMG_DEFAULT_INTERVAL: "D",
    CHARTIMG_DEFAULT_THEME: "light",
    CHARTIMG_EXCHANGE: "BMFBOVESPA",
    CHARTIMG_MAX_CALLS_PER_HOUR: "2",
  }),
  getNumericEnv: (value: string | undefined, fallback: number) =>
    value ? Number(value) : fallback,
}));

vi.mock("@/server/services/storage/redis", () => ({
  getJson: getJsonMock,
  setJson: setJsonMock,
  redis: () => redisMock,
}));

vi.stubGlobal("fetch", fetchMock);

import { getChartImage } from "@/server/services/market/chartImg";

describe("getChartImage", () => {
  beforeEach(() => {
    cache.clear();
    quotaStore.clear();
    getJsonMock.mockClear();
    setJsonMock.mockClear();
    redisMock.get.mockClear();
    redisMock.incr.mockClear();
    redisMock.expire.mockClear();
    fetchMock.mockReset();
  });

  it("returns cached entry without calling API", async () => {
    const cached = {
      url: "https://chart.example/test.png",
      fetchedAt: new Date().toISOString(),
      range: "1M",
      interval: "D",
      symbol: "BMFBOVESPA:PETR4",
    };
    cache.set("chartimg:BMFBOVESPA:PETR4:1M:D:light", cached);

    const result = await getChartImage({ ticker: "PETR4" });

    expect(result).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches new image and stores in cache", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ imageUrl: "https://chart.example/new.png" }),
    });

    const result = await getChartImage({ ticker: "VALE3" });

    expect(result?.url).toBe("https://chart.example/new.png");
    expect(setJsonMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respects quota limit", async () => {
    const now = new Date().toISOString().slice(0, 13);
    quotaStore.set(`chartimg:quota:${now}`, 2);

    const result = await getChartImage({ ticker: "ITUB4" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
