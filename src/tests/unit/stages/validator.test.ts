import { describe, expect, it } from "vitest";
import { validateCitations } from "@/server/agent/validator";

const bullets = [
  "Petrobras anuncia investimento",
  "Impacto previsto para a produção",
];

const citations = [
  {
    url: "https://valor.globo.com/noticia",
    title: "Valor Econômico",
    quote: "Detalhes do investimento",
    associatedBullet: 0,
  },
  {
    url: "https://infomoney.com.br/noticia",
    title: "InfoMoney",
    quote: "Analistas comentam impacto",
    associatedBullet: 1,
  },
];

describe("citation validator", () => {
  it("accepts well-formed citations", () => {
    expect(() => validateCitations(bullets, citations)).not.toThrow();
  });

  it("rejects bullets without citations", () => {
    const invalid = citations.slice(0, 1);
    expect(() => validateCitations(bullets, invalid)).toThrowError(
      /missing citations/,
    );
  });
});
