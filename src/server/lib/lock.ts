import crypto from "crypto";
import { redis } from "@/server/services/storage/redis";

export type LockHandle = {
  key: string;
  token: string;
};

export async function acquireLock(
  key: string,
  ttlSeconds: number,
): Promise<LockHandle | null> {
  const token = crypto.randomUUID();
  const result = await redis.set(key, token, { ex: ttlSeconds, nx: true });
  if (result === "OK") {
    return { key, token };
  }
  return null;
}

export async function releaseLock(handle: LockHandle | null) {
  if (!handle) return;
  const current = await redis.get<string | null>(handle.key);
  if (current === handle.token) {
    await redis.del(handle.key);
  }
}
