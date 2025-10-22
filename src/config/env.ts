import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AI_GATEWAY_API_KEY: z.string(),
  AI_GATEWAY_BASE_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  UPSTASH_SEARCH_REST_URL: z.string().url(),
  UPSTASH_SEARCH_REST_TOKEN: z.string(),
  UPSTASH_SEARCH_INDEX: z.string().default("news-br"),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_CHAT_ID: z.string(),
  CRON_SECRET: z.string().optional(),
  MAX_NEWS_PER_RUN: z.string().optional(),
  RELEVANCE_THRESHOLD: z.string().optional(),
  DEDUP_SIMILARITY_THRESHOLD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Failed to load environment variables: ${parsed.error.message}`,
    );
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getNumericEnv(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}
