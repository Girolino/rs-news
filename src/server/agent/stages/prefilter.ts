import { isOlderThanHours } from "@/lib/utils";
import { generateNewsId, normalizeTitle, canonicalizeUrl } from "@/server/lib/hash";
import {
  discoveryNewsItemSchema,
  prefilteredNewsItemSchema,
  type DiscoveryNewsItem,
  type PrefilteredNewsItem,
} from "@/types/news";
import { logger } from "@/server/lib/logger";

const MIN_BODY_LENGTH = 100;
const MAX_AGE_HOURS = 12;

const KEYWORDS = [
  "b3",
  "ibovespa",
  "selic",
  "ipca",
  "petr",
  "vale",
  "resultado",
  "dividendo",
  "fusao",
  "aquisição",
  "companhia",
  "empresa",
  "lucro",
  "prejuízo",
  "balanço",
  "projeção",
  "economia",
  "inflacao",
  "inflação",
  "juros",
  "bc",
  "banco central",
];

function isPortuguese(text: string): boolean {
  const normalized = text.toLowerCase();
  const stopwords = [
    " de ",
    " em ",
    " para ",
    " que ",
    " por ",
    " com ",
    " na ",
    " no ",
    " uma ",
    " um ",
  ];
  return stopwords.some((word) => normalized.includes(word));
}

export type PrefilterResult = {
  items: PrefilteredNewsItem[];
  discarded: number;
};

export function runPrefilterStage(
  discovered: DiscoveryNewsItem[],
  now: Date = new Date(),
): PrefilterResult {
  logger.info("stage.prefilter.start", { total: discovered.length });
  let discarded = 0;
  const seenUrls = new Set<string>();
  const results: PrefilteredNewsItem[] = [];

  for (const item of discovered) {
    try {
      discoveryNewsItemSchema.parse(item);
    } catch (error) {
      discarded += 1;
      logger.warn("stage.prefilter.invalid_input", {
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (item.body.length < MIN_BODY_LENGTH) {
      discarded += 1;
      continue;
    }

    if (isOlderThanHours(item.publishedAt, MAX_AGE_HOURS, now)) {
      discarded += 1;
      continue;
    }

    const languageSample = `${item.title} ${item.body.slice(0, 200)}`;
    if (!isPortuguese(languageSample)) {
      discarded += 1;
      continue;
    }

    const content = `${item.title} ${item.body}`.toLowerCase();
    if (!KEYWORDS.some((keyword) => content.includes(keyword))) {
      discarded += 1;
      continue;
    }

    const canonicalUrl = canonicalizeUrl(item.url);
    if (seenUrls.has(canonicalUrl)) {
      discarded += 1;
      continue;
    }
    seenUrls.add(canonicalUrl);

    const newsId = generateNewsId(item.url, item.title);
    const normalizedTitle = normalizeTitle(item.title);
    const enriched = {
      ...item,
      newsId,
      normalizedTitle,
    };
    try {
      prefilteredNewsItemSchema.parse(enriched);
      results.push(enriched);
    } catch (error) {
      discarded += 1;
      logger.warn("stage.prefilter.validation_failed", {
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("stage.prefilter.complete", {
    total: discovered.length,
    passed: results.length,
    discarded,
  });

  return { items: results, discarded };
}
