import { Redis } from "@upstash/redis";
import { loadEnv } from "@/config/env";

// Lazy initialization
let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    const env = loadEnv();
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// Export redis instance getter
export { getRedis as redis };

export async function setJson<T>(
  key: string,
  value: T,
  options?: { ttlSeconds?: number },
) {
  const client = getRedis();
  const serialized = JSON.stringify(value);
  await client.set(key, serialized);
  if (options?.ttlSeconds) {
    await client.expire(key, options.ttlSeconds);
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const client = getRedis();
  const value = await client.get<string | null>(key);
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
  const client = getRedis();
  await client.del(key);
}
