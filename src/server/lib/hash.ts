import crypto from "crypto";

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function generateNewsId(url: string, title: string): string {
  const canonicalUrl = canonicalizeUrl(url);
  const normalizedTitle = normalizeTitle(title);
  return crypto
    .createHash("sha256")
    .update(`${canonicalUrl}::${normalizedTitle}`)
    .digest("hex");
}
