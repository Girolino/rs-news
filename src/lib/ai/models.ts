export const AI_MODELS = {
  discovery: "gpt-5-mini",
  rerank: "gpt-5-mini",
  summarize: "gpt-5-mini",
  commentary: "gpt-5-mini",
} as const;

export type ModelKey = keyof typeof AI_MODELS;

export function getModelName(key: ModelKey) {
  return AI_MODELS[key];
}
