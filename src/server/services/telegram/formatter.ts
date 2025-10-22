import { StructuredNewsItem } from "@/types/news";

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

export function buildTelegramMessage(news: StructuredNewsItem): string {
  const bullets = news.bullets
    .map((bullet) => `• ${escapeHtml(bullet)}`)
    .join("\n");

  const sources = news.citations
    .map(
      (citation) =>
        `• <a href="${escapeHtml(citation.url)}">${escapeHtml(citation.title)}</a>`,
    )
    .join("\n");

  const companies =
    news.companies.length > 0 ? news.companies.join(", ") : "N/D";

  const hashtags =
    news.hashtags.length > 0
      ? news.hashtags.join(" ")
      : "#ECONOMIA #B3 #MERCADO";

  return [
    `🔔 <b>${escapeHtml(news.finalTitle)}</b>`,
    "",
    `📊 <b>Resumo:</b> ${escapeHtml(news.summary)}`,
    "",
    `<b>Principais Pontos:</b>`,
    bullets,
    "",
    `<b>📈 Empresas:</b> ${escapeHtml(companies)}`,
    "",
    `<b>🔗 Fontes:</b>`,
    sources,
    "",
    hashtags,
  ]
    .filter((section) => section !== "")
    .join("\n");
}
