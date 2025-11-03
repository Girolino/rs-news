const BIT_LENGTH = 64;

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

export type Fingerprint = bigint;

const textEncoder = new TextEncoder();

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv1a64(input: string): bigint {
  let hash = FNV_OFFSET_BASIS;
  const bytes = textEncoder.encode(input);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(BIT_LENGTH, hash * FNV_PRIME);
  }
  return BigInt.asUintN(BIT_LENGTH, hash);
}

export function buildFingerprintText(options: {
  title?: string;
  body?: string;
  summaryForSearch?: string;
}): string {
  const parts = [
    options.title ?? "",
    options.body && options.body.length > 0 ? options.body : "",
    !options.body || options.body.length === 0 ? options.summaryForSearch ?? "" : "",
  ]
    .join(" ")
    .trim();

  return normalizeText(parts);
}

export function computeFingerprint(text: string): Fingerprint | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const tokens = normalized.split(" ").filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return null;
  }

  const vector = new Array<number>(BIT_LENGTH).fill(0);
  for (const token of tokens) {
    const hash = fnv1a64(token);
    for (let bit = 0; bit < BIT_LENGTH; bit += 1) {
      const mask = 1n << BigInt(bit);
      vector[bit] += (hash & mask) !== 0n ? 1 : -1;
    }
  }

  let fingerprint = 0n;
  for (let bit = 0; bit < BIT_LENGTH; bit += 1) {
    if (vector[bit] >= 0) {
      fingerprint |= 1n << BigInt(bit);
    }
  }

  return BigInt.asUintN(BIT_LENGTH, fingerprint);
}

export function hammingDistance(a: Fingerprint, b: Fingerprint): number {
  let diff = BigInt.asUintN(BIT_LENGTH, a ^ b);
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

export function fingerprintToHex(fingerprint: Fingerprint): string {
  return fingerprint.toString(16).padStart(BIT_LENGTH / 4, "0");
}

export function fingerprintFromHex(hex: string | undefined | null): Fingerprint | null {
  if (!hex) {
    return null;
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  try {
    return BigInt(`0x${hex}`);
  } catch {
    return null;
  }
}
