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

const TOPIC_LABELS: Record<StructuredNewsItem["topic"], string> = {
  economia: "Economia",
  politica: "Política",
  empresas: "Empresas",
  mercados: "Mercados",
  tecnologia: "Tecnologia",
};

export function buildTelegramMessage(news: StructuredNewsItem): string {
  const bullets = news.bullets
    .map((bullet) => `• ${escapeHtml(bullet)}`)
    .join("\n");

  // Deduplicate citations by URL
  const uniqueCitations = news.citations.reduce((acc, citation) => {
    if (!acc.some((c) => c.url === citation.url)) {
      acc.push(citation);
    }
    return acc;
  }, [] as typeof news.citations);

  const sources = uniqueCitations
    .map(
      (citation) =>
        `• <a href="${escapeHtml(citation.url)}">${escapeHtml(citation.title)}</a>`,
    )
    .join("\n");

  const topicLabel = TOPIC_LABELS[news.topic] ?? news.topic;

  const tags =
    news.tags.length > 0 ? news.tags.join(", ") : "N/D";

  return [
    `🔔 <b>${escapeHtml(news.finalTitle)}</b>`,
    "",
    `📊 <b>Resumo:</b> ${escapeHtml(news.summary)}`,
    "",
    `<b>Principais Pontos:</b>`,
    bullets,
    "",
    `<b>📌 Assunto:</b> ${escapeHtml(topicLabel)}`,
    `<b>🏷️ Tags:</b> ${escapeHtml(tags)}`,
    "",
    `<b>🔗 Fontes:</b>`,
    sources,
  ]
    .filter((section) => section !== "")
    .join("\n");
}
