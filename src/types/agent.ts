import { z } from "zod";

export const agentStageSchema = z.enum([
  "trigger",
  "discovery",
  "prefilter",
  "rerank",
  "deduplication",
  "summarization",
  "format",
  "send",
  "persist",
  "metrics",
]);

export type AgentStage = z.infer<typeof agentStageSchema>;

export const agentConfigSchema = z.object({
  maxNewsPerRun: z.number().int().positive().default(10),
  relevanceThreshold: z.number().min(0).max(10).default(7),
  dedupSimilarityThreshold: z.number().min(0).max(1).default(0.9),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const agentMetricsSchema = z.object({
  discoveredCount: z.number().int().nonnegative(),
  filteredCount: z.number().int().nonnegative(),
  relevantCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  executionTimeMs: z.number().int().nonnegative(),
  aiGatewayCost: z.number().nonnegative().optional(),
});

export type AgentMetrics = z.infer<typeof agentMetricsSchema>;

export const agentResultSchema = z.object({
  metrics: agentMetricsSchema,
  sentNewsIds: z.array(z.string()),
});

export type AgentResult = z.infer<typeof agentResultSchema>;
