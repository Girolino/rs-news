import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, string>();

vi.mock("@/server/services/storage/redis", () => ({
  redis: {
    set: vi.fn(async (key: string, value: string, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return "OK";
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  },
}));

import { acquireLock, releaseLock } from "@/server/lib/lock";

describe("redis lock", () => {
  beforeEach(() => {
    store.clear();
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
