import { z } from "zod";
import type { RerankedNewsItem, StoredNewsRecord } from "@/types/news";

export const MAX_SENDER_DELAY_MINUTES = 30;

/**
 * Payload para a task de orquestração (scheduled)
 * Input: vazio (triggered by schedule)
 */
export const orchestratorInputSchema = z.object({
  // Vazio - task é scheduled
});

export type OrchestratorInput = z.infer<typeof orchestratorInputSchema>;

/**
 * Output da task de orquestração
 * Retorna as notícias que foram processadas e enviadas para a queue
 */
export const orchestratorOutputSchema = z.object({
  discoveredCount: z.number(),
  filteredCount: z.number(),
  relevantCount: z.number(),
  duplicateCount: z.number(),
  queuedForSendingCount: z.number(),
  executionTimeMs: z.number(),
  timestamp: z.string().datetime({ offset: true }),
});

export type OrchestratorOutput = z.infer<typeof orchestratorOutputSchema>;

/**
 * Payload para a task de envio individual
 * Input: uma notícia reranked para processar
 */
export const senderInputSchema = z.object({
  newsItem: z.any(), // RerankedNewsItem (usando any para evitar problemas de importação circular)
  delayMinutes: z
    .number()
    .min(0)
    .max(MAX_SENDER_DELAY_MINUTES)
    .optional(), // Delay opcional antes de processar
});

export type SenderInput = z.infer<typeof senderInputSchema>;

/**
 * Output da task de envio
 * Retorna o resultado do envio
 */
export const senderOutputSchema = z.object({
  newsId: z.string(),
  sent: z.boolean(),
  telegramMessageId: z.number().int().positive().optional(),
  error: z.string().optional(),
  sentAt: z.string().datetime({ offset: true }),
});

export type SenderOutput = z.infer<typeof senderOutputSchema>;

/**
 * Metadata para tracking de progresso
 */
export type TaskMetadata = {
  stage?: string;
  progress?: number;
  currentOperation?: string;
  newsId?: string;
  timestamp?: string;
};
