import { z } from "zod";

export const discoveryNewsItemSchema = z.object({
  id: z.string().min(1, "id is required"),
  url: z.string().url("url must be valid"),
  title: z.string().min(1, "title is required"),
  publishedAt: z.string().datetime({ offset: true }),
  body: z.string().min(1, "body text is required"),
  source: z.string().min(1).optional(),
});

export type DiscoveryNewsItem = z.infer<typeof discoveryNewsItemSchema>;

export const prefilteredNewsItemSchema = discoveryNewsItemSchema.extend({
  newsId: z.string().min(1, "newsId is required"),
  normalizedTitle: z.string().min(1, "normalizedTitle is required"),
});

export type PrefilteredNewsItem = z.infer<typeof prefilteredNewsItemSchema>;

export const newsImpactSchema = z.enum(["alta", "média", "baixa"]);

export type NewsImpact = z.infer<typeof newsImpactSchema>;

export const newsTopicSchema = z.enum([
  "economia",
  "politica",
  "empresas",
  "mercados",
  "tecnologia",
]);

export type NewsTopic = z.infer<typeof newsTopicSchema>;

export const rerankedNewsItemSchema = prefilteredNewsItemSchema.extend({
  relevanceScore: z.number().min(0).max(10),
  impact: newsImpactSchema,
  companies: z.array(z.string().min(1)).default([]),
  categories: z.array(z.string().min(1)).default([]),
  shouldProcess: z.boolean(),
});

export type RerankedNewsItem = z.infer<typeof rerankedNewsItemSchema>;

export const citationSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  quote: z.string().min(1),
  associatedBullet: z.number().int().nonnegative(),
});

export type Citation = z.infer<typeof citationSchema>;

export const structuredNewsItemSchema = rerankedNewsItemSchema.extend({
  finalTitle: z.string().min(1),
  summary: z.string().min(1).max(200),
  bullets: z.array(z.string().min(1)).min(1),
  citations: z.array(citationSchema).min(1),
  topic: newsTopicSchema,
  tags: z
    .array(
      z
        .string()
        .regex(/^[A-Z0-9]{1,7}(?:\.[A-Z0-9]{1,3})?$/, {
          message:
            "tags must be uppercase tickers, e.g. PETR4 or AAPL or ITUB4.SA",
        })
        .min(1),
    )
    .default([]),
  summaryForSearch: z.string().min(1),
});

export type StructuredNewsItem = z.infer<typeof structuredNewsItemSchema>;

export const formattedNewsItemSchema = structuredNewsItemSchema.extend({
  messageHtml: z.string().min(1).max(4096),
});

export type FormattedNewsItem = z.infer<typeof formattedNewsItemSchema>;

export const storedNewsRecordSchema = formattedNewsItemSchema.extend({
  telegramMessageId: z.number().int().positive().optional(),
  sentAt: z.string().datetime({ offset: true }),
  failedToSend: z.boolean().default(false),
});

export type StoredNewsRecord = z.infer<typeof storedNewsRecordSchema>;

export const discoveredNewsBatchSchema = z.array(discoveryNewsItemSchema);

export type DiscoveredNewsBatch = z.infer<typeof discoveredNewsBatchSchema>;
