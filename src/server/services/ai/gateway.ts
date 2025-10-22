import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import type { ZodSchema } from "zod";
import { loadEnv } from "@/config/env";

// Lazy initialization to allow dotenv to load first
let openai: ReturnType<typeof createOpenAI> | null = null;

function getOpenAI() {
  if (!openai) {
    const env = loadEnv();
    openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export async function runGenerateText(model: string, prompt: string) {
  const result = await generateText({
    model: getOpenAI()(model),
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
    model: getOpenAI()(model),
    schema,
    prompt,
  });
  return result.object;
}

export function getOpenAIClient() {
  return getOpenAI();
}
