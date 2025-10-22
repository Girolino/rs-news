import pRetry from "p-retry";
import { loadEnv } from "@/config/env";
import {
  telegramSendMessagePayloadSchema,
  telegramSendMessageResponseSchema,
  type TelegramSendMessagePayload,
  type TelegramSendMessageResponse,
} from "@/types/telegram";

// Lazy initialization
let TELEGRAM_BASE_URL: string | null = null;

function getTelegramBaseUrl() {
  if (!TELEGRAM_BASE_URL) {
    const env = loadEnv();
    TELEGRAM_BASE_URL = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  }
  return TELEGRAM_BASE_URL;
}

async function sendMessageOnce(
  payload: TelegramSendMessagePayload,
): Promise<TelegramSendMessageResponse> {
  const body = telegramSendMessagePayloadSchema.parse(payload);

  const response = await fetch(`${getTelegramBaseUrl()}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(
      `Telegram API error: ${response.status} ${response.statusText} - ${errorPayload}`,
    );
  }

  const json = await response.json();
  return telegramSendMessageResponseSchema.parse(json);
}

export async function sendTelegramMessage(
  payload: TelegramSendMessagePayload,
) {
  return pRetry(
    () => sendMessageOnce(payload),
    {
      retries: 2,
      factor: 2,
      minTimeout: 1000,
    },
  );
}

export function getDefaultChatId(): string | number {
  const env = loadEnv();
  return env.TELEGRAM_CHAT_ID;
}
