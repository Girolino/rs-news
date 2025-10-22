import { describe, expect, it } from "vitest";
import { generateNewsId, canonicalizeUrl, normalizeTitle } from "@/server/lib/hash";

describe("hash helpers", () => {
  it("canonicalizes URLs removing query params order and hash", () => {
    const urlA = "https://example.com/news?id=1&ref=a#section";
    const urlB = "https://example.com/news?ref=a&id=1";
    expect(canonicalizeUrl(urlA)).toBe("https://example.com/news?id=1&ref=a");
    expect(canonicalizeUrl(urlB)).toBe("https://example.com/news?id=1&ref=a");
  });

  it("normalizes titles", () => {
    expect(normalizeTitle("  Petrobras   anuncia  Resultado ")).toBe(
      "petrobras anuncia resultado",
    );
  });

  it("generates deterministic ids", () => {
    const id1 = generateNewsId("https://example.com/news?id=1", "Titulo A");
    const id2 = generateNewsId("https://example.com/news?id=1", "Titulo A");
    const id3 = generateNewsId("https://example.com/news?id=2", "Titulo A");
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });
});
