import { z } from "zod";

export const telegramSendMessagePayloadSchema = z.object({
  chat_id: z.union([z.number(), z.string()]),
  text: z.string().min(1),
  parse_mode: z.literal("HTML"),
  disable_web_page_preview: z.boolean().default(true),
});

export type TelegramSendMessagePayload = z.infer<
  typeof telegramSendMessagePayloadSchema
>;

export const telegramMessageSchema = z.object({
  message_id: z.number().int().positive(),
  date: z.number().int(),
  chat: z.object({
    id: z.number().int(),
    type: z.string(),
    title: z.string().optional(),
    username: z.string().optional(),
  }),
});

export type TelegramMessage = z.infer<typeof telegramMessageSchema>;

export const telegramSendMessageResponseSchema = z.object({
  ok: z.boolean(),
  result: telegramMessageSchema.optional(),
  description: z.string().optional(),
});

export type TelegramSendMessageResponse = z.infer<
  typeof telegramSendMessageResponseSchema
>;
