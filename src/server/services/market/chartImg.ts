import pRetry from "p-retry";
import { loadEnv, getNumericEnv } from "@/config/env";
import { logger } from "@/server/lib/logger";
import { getJson, setJson, redis } from "@/server/services/storage/redis";

const API_URL = "https://api.chart-img.com/v1/tradingview/advanced-chart/storage";
const CACHE_TTL_SECONDS = 600;

type ChartImageCacheEntry = {
  url: string;
  fetchedAt: string;
  range: string;
  interval: string;
  symbol: string;
};

export type ChartImageOptions = {
  ticker: string;
  range?: string;
  interval?: string;
  theme?: string;
};

export type ChartImageResult = ChartImageCacheEntry;

function buildSymbol(ticker: string, exchange: string): string {
  const normalized = ticker
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "")
    .split(".")[0];
  return `${exchange}:${normalized}`;
}

function cacheKey(entry: {
  symbol: string;
  range: string;
  interval: string;
  theme: string;
}): string {
  return `chartimg:${entry.symbol}:${entry.range}:${entry.interval}:${entry.theme}`;
}

async function withinQuota(limit: number): Promise<boolean> {
  if (limit <= 0) {
    return true;
  }
  const client = redis();
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const quotaKey = `chartimg:quota:${hourKey}`;
  const currentRaw = await client.get<string | null>(quotaKey);
  const current = currentRaw ? Number(currentRaw) : 0;
  if (!Number.isNaN(current) && current >= limit) {
    return false;
  }
  const next = await client.incr(quotaKey);
  if (next === 1) {
    await client.expire(quotaKey, 3600);
  }
  return next <= limit;
}

export async function getChartImage(
  options: ChartImageOptions,
): Promise<ChartImageResult | null> {
  const env = loadEnv();
  const apiKey = env.CHARTIMG_SECRET_KEY;
  if (!apiKey) {
    logger.warn("chartimg.disabled", { reason: "missing_api_key" });
    return null;
  }

  const exchange = env.CHARTIMG_EXCHANGE ?? "BMFBOVESPA";
  const interval = options.interval ?? env.CHARTIMG_DEFAULT_INTERVAL ?? "1D";
  const range = options.range ?? env.CHARTIMG_DEFAULT_RANGE ?? "1M";
  const theme = options.theme ?? env.CHARTIMG_DEFAULT_THEME ?? "light";
  const symbol = buildSymbol(options.ticker, exchange);

  const key = cacheKey({ symbol, range, interval, theme });
  const cached = await getJson<ChartImageCacheEntry>(key);
  if (cached) {
    logger.info("chartimg.cache_hit", { symbol, range, interval });
    return cached;
  }

  const limit = getNumericEnv(env.CHARTIMG_MAX_CALLS_PER_HOUR, 10);
  const hasQuota = await withinQuota(limit);
  if (!hasQuota) {
    logger.warn("chartimg.quota_exceeded", { symbol, limit });
    return null;
  }

  const query = new URLSearchParams({
    symbol,
    interval,
    range,
    theme,
    width: "800",
    height: "500",
    format: "png",
  });

  const fetchChart = async () => {
    const response = await fetch(`${API_URL}?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return (await response.json()) as ChartImgApiResponse;
  };

  type ChartImgApiResponse = {
    imageUrl?: string;
    url?: string;
    error?: { message?: string };
  };

  let data: ChartImgApiResponse;
  try {
    data = await pRetry(fetchChart, {
      retries: 2,
      factor: 2,
      minTimeout: 500,
    });
  } catch (error) {
    logger.error("chartimg.request_failed", {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  const imageUrl = data.imageUrl ?? data.url;
  if (!imageUrl) {
    logger.error("chartimg.invalid_response", {
      symbol,
      payload: data,
    });
    return null;
  }

  const entry: ChartImageCacheEntry = {
    url: imageUrl,
    fetchedAt: new Date().toISOString(),
    range,
    interval,
    symbol,
  };

  await setJson(key, entry, { ttlSeconds: CACHE_TTL_SECONDS });
  logger.info("chartimg.cache_store", { symbol, range, interval });

  return entry;
}
