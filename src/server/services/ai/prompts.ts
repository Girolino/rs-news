import type { DiscoveryNewsItem, PrefilteredNewsItem } from "@/types/news";

export function buildDiscoveryPrompt(
  queries: string[],
  domainWhitelist: string[],
) {
  return `
You are a financial news hunter focused on the Brazilian market.
Your task is to run targeted web searches (already executed) and return raw results in JSON.

Search queries (already executed for you):
${queries.map((query) => `- ${query}`).join("\n")}

Whitelist domains only:
${domainWhitelist.map((domain) => `- ${domain}`).join("\n")}

Return an array of objects with:
- id (string, unique, use hash of url+title)
- url (string)
- title (string)
- timestamp ISO 8601 with timezone
- body_text_clean (string, at least 100 characters)
- source (domain name)
`.trim();
}

export function buildRerankPrompt(
  prefiltered: PrefilteredNewsItem[],
  maxNews: number,
) {
  const items = prefiltered
    .map(
      (news, index) => `
Item #${index + 1}
ID: ${news.id}
Title: ${news.title}
Published At: ${news.publishedAt}
URL: ${news.url}
Body:
${news.body.slice(0, 2000)}
`,
    )
    .join("\n---\n");

  return `
You are a senior financial editor specializing in Brazilian markets.
Evaluate each news item and score its relevance for a Telegram channel about companies listed on B3 and macroeconomic indicators.
Use a 0-10 relevance scale. Items scoring under 7 should have shouldProcess=false.

Output JSON with:
- id (must match the provided ID exactly)
- relevanceScore (0-10)
- impact: "alta" | "média" | "baixa"
- companies: array of tickers or company names involved
- categories: array of tags like ["macro", "energy", "banking"]
- shouldProcess: boolean

Return at most ${maxNews} items marked shouldProcess=true.

${items}
`.trim();
}

export function buildSummarizePrompt(news: DiscoveryNewsItem) {
  return `
You are a concise financial news summarizer for Telegram.
Summarize the following article in Brazilian Portuguese.

Requirements:
- Title <= 80 chars, professional tone
- Summary <= 200 chars, highlight key data or implications
- Provide 2-3 bullet points, each <= 180 chars
- Each bullet must reference one citation
- IMPORTANT: associatedBullet is ZERO-INDEXED (first bullet = 0, second bullet = 1, third bullet = 2)
- Cite only URLs provided
- Set a topic (one of: economia, politica, empresas, mercados, tecnologia)
- Provide up to 3 tags using uppercase tickers only (e.g., PETR4, VALE3, AAPL). Do NOT include hashtags (#) or free text. Return an empty array if no ticker applies.

Example citations for 3 bullets:
- { "associatedBullet": 0, ... } // references first bullet
- { "associatedBullet": 1, ... } // references second bullet
- { "associatedBullet": 2, ... } // references third bullet

Article:
Title: ${news.title}
Published At: ${news.publishedAt}
URL: ${news.url}
Body:
${news.body.slice(0, 4000)}
`.trim();
}
