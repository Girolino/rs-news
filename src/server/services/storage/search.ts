import { Search } from "@upstash/search";
import { loadEnv } from "@/config/env";

// Lazy initialization
let searchIndex: ReturnType<typeof Search.prototype.index<Record<string, unknown>, Record<string, unknown>>> | null = null;

function getSearchIndex() {
  if (!searchIndex) {
    const env = loadEnv();
    const client = new Search({
      url: env.UPSTASH_SEARCH_REST_URL,
      token: env.UPSTASH_SEARCH_REST_TOKEN,
    });
    searchIndex = client.index<Record<string, unknown>, Record<string, unknown>>(
      env.UPSTASH_SEARCH_INDEX,
    );
  }
  return searchIndex;
}

export { getSearchIndex as searchIndex };

export async function searchSimilar(
  query: string,
  options?: { topK?: number },
) {
  return getSearchIndex().search({
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
  await getSearchIndex().upsert([
    {
      id,
      content: { text: content },
      metadata,
    },
  ]);
}
