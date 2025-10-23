import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, string>();

const setMock = vi.fn(
  async (key: string, value: string, opts?: { nx?: boolean }) => {
    if (opts?.nx && store.has(key)) {
      return null;
    }
    store.set(key, value);
    return "OK";
  },
);
const getMock = vi.fn(async (key: string) => store.get(key) ?? null);
const delMock = vi.fn(async (key: string) => {
  store.delete(key);
  return 1;
});

vi.mock("@/server/services/storage/redis", () => ({
  redis: vi.fn(() => ({
    set: setMock,
    get: getMock,
    del: delMock,
  })),
}));

import { acquireLock, releaseLock } from "@/server/lib/lock";

describe("redis lock", () => {
  beforeEach(() => {
    store.clear();
    setMock.mockClear();
    getMock.mockClear();
    delMock.mockClear();
  });

  it("acquires and releases lock", async () => {
    const handle = await acquireLock("lock:test", 10);
    expect(handle).toBeTruthy();
    const again = await acquireLock("lock:test", 10);
    expect(again).toBeNull();
    await releaseLock(handle);
    const third = await acquireLock("lock:test", 10);
    expect(third).toBeTruthy();
  });
});
