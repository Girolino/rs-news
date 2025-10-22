import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import type { ZodSchema } from "zod";
import { loadEnv } from "@/config/env";

const env = loadEnv();

const openai = createOpenAI({
  apiKey: env.AI_GATEWAY_API_KEY,
  baseURL: env.AI_GATEWAY_BASE_URL,
});

export async function runGenerateText(model: string, prompt: string) {
  const result = await generateText({
    model: openai(model),
    prompt,
  });
  return result.text;
}

export async function runGenerateObject<T>(
  model: string,
  schema: ZodSchema<T>,
  prompt: string,
) {
  const result = await generateObject({
    model: openai(model),
    schema,
    prompt,
  });
  return result.object;
}

export function getOpenAIClient() {
  return openai;
}
