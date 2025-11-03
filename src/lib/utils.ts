export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`);
}

export function toISOString(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return parsed.toISOString();
}

export function isOlderThanHours(
  isoDate: string,
  hours: number,
  now: Date = new Date(),
) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return true;
  }
  const diffMs = now.getTime() - date.getTime();
  return diffMs > hours * 60 * 60 * 1000;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error("Chunk size must be greater than zero");
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
