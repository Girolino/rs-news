import { z } from "zod";
import type { RerankedNewsItem, StoredNewsRecord } from "@/types/news";

export const MAX_SENDER_DELAY_MINUTES = 30;

const senderChannelSchema = z.object({
  id: z.string(),
  chatId: z.union([z.number(), z.string()]),
  features: z
    .object({
      commentary: z.boolean().optional(),
      chartImg: z.boolean().optional(),
    })
    .optional(),
});

export type SenderChannel = z.infer<typeof senderChannelSchema>;

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
  channels: z.array(
    z.object({
      channelId: z.string(),
      discoveredCount: z.number(),
      filteredCount: z.number(),
      relevantCount: z.number(),
      duplicateCount: z.number(),
      queuedForSendingCount: z.number(),
      status: z.string(),
      senderBatchId: z.string().optional(),
    }),
  ),
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
  channel: senderChannelSchema,
});

export type SenderInput = z.infer<typeof senderInputSchema>;

/**
 * Output da task de envio
 * Retorna o resultado do envio
 */
export const senderOutputSchema = z.object({
  newsId: z.string(),
  sent: z.boolean(),
  channelId: z.string(),
  telegramMessageId: z.number().int().positive().optional(),
  error: z.string().optional(),
  sentAt: z.string().datetime({ offset: true }),
  chartMessageId: z.number().int().positive().optional(),
  chartSent: z.boolean().optional(),
  commentaryMessageId: z.number().int().positive().optional(),
  commentarySent: z.boolean().optional(),
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
