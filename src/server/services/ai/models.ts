export const MODELS = {
  DISCOVERY: "openai:gpt-4o-mini",
  RERANK: "openai:gpt-4o-mini",
  SUMMARIZE: "openai:gpt-4o",
} as const;

export type ModelKey = keyof typeof MODELS;

export function getModelName(key: ModelKey) {
  return MODELS[key];
}
