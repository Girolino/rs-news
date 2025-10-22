import { Search } from "@upstash/search";
import { loadEnv } from "@/config/env";

const env = loadEnv();

const client = new Search({
  url: env.UPSTASH_SEARCH_REST_URL,
  token: env.UPSTASH_SEARCH_REST_TOKEN,
});

export const searchIndex = client.index<Record<string, unknown>, Record<string, unknown>>(
  env.UPSTASH_SEARCH_INDEX,
);

export async function searchSimilar(
  query: string,
  options?: { topK?: number },
) {
  return searchIndex.search({
    query,
    limit: options?.topK ?? 5,
    reranking: true,
  });
}

export async function upsertDocument(
  id: string,
  content: string,
  metadata: Record<string, unknown>,
) {
  await searchIndex.upsert([
    {
      id,
      content: { text: content },
      metadata,
    },
  ]);
}
