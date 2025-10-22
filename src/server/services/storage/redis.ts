import { Redis } from "@upstash/redis";
import { loadEnv } from "@/config/env";

const env = loadEnv();

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export async function setJson<T>(
  key: string,
  value: T,
  options?: { ttlSeconds?: number },
) {
  const serialized = JSON.stringify(value);
  await redis.set(key, serialized);
  if (options?.ttlSeconds) {
    await redis.expire(key, options.ttlSeconds);
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const value = await redis.get<string | null>(key);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to parse JSON from Redis", { key, error });
    return null;
  }
}

export async function del(key: string) {
  await redis.del(key);
}
