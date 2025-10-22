import { loadEnv } from "@/config/env";

const env = loadEnv();

export const MODELS = {
  DISCOVERY: env.AI_DISCOVERY_MODEL ?? "openai/gpt-5-mini",
  RERANK: env.AI_RERANK_MODEL ?? "openai/gpt-5-mini",
  SUMMARIZE: env.AI_SUMMARY_MODEL ?? "openai/gpt-5-mini",
} as const;

export type ModelKey = keyof typeof MODELS;

export function getModelName(key: ModelKey) {
  return MODELS[key];
}
