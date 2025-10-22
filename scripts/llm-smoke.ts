import { config } from "dotenv";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { AI_MODELS } from "@/lib/ai/models";

// Carrega .env.local explicitamente
config({ path: ".env.local" });

async function testBasicConnection() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não definido no ambiente.");
  }

  const model = AI_MODELS.discovery;

  const openai = createOpenAI({
    apiKey,
  });

  const response = await generateText({
    model: openai(model),
    prompt:
      "Responda apenas com 'OK' para confirmar que o gateway de IA está operacional.",
  });

  const text = response.text.trim();
  if (text.toUpperCase() !== "OK") {
    throw new Error(`Resposta inesperada do modelo: ${text}`);
  }

  console.log("✅ Teste básico OK");
  return { model };
}

async function testWebSearchWithCitations() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não definido no ambiente.");
  }

  const model = AI_MODELS.discovery;

  const openai = createOpenAI({
    apiKey,
  });

  console.log("🔍 Testando web search com Responses API...");

  // Usa Responses API com openai.tools.webSearch()
  // Desde AI SDK 5, openai(model) já usa Responses API por padrão
  const response = await generateText({
    model: openai(model),
    prompt: "Quais foram as 3 principais notícias sobre empresas brasileiras publicadas hoje? Liste título, fonte e URL de cada uma.",
    tools: {
      web_search: openai.tools.webSearch({
        searchContextSize: "medium",
        userLocation: {
          type: "approximate",
          city: "São Paulo",
          region: "São Paulo",
          country: "BR",
        },
      }),
    },
    // Força o uso da tool de web search
    toolChoice: { type: "tool", toolName: "web_search" },
    maxSteps: 5,
  });

  const text = response.text.trim();

  // Verifica se há conteúdo
  if (!text || text.length < 50) {
    throw new Error("Resposta vazia ou muito curta do web search");
  }

  // Verifica se há URLs (indicativo de citations)
  const hasUrls = text.includes("http://") || text.includes("https://");

  // Acessa as fontes retornadas pelo web search
  interface WebSearchSource {
    type: string;
    sourceType: string;
    id: string;
    url: string;
    title: string;
  }
  const sources = (response as unknown as { sources?: WebSearchSource[] }).sources || [];
  const hasSources = sources.length > 0;

  // Verifica se usou a tool
  interface ToolCall {
    toolName: string;
    [key: string]: unknown;
  }
  interface Step {
    toolCalls?: ToolCall[];
    [key: string]: unknown;
  }
  const responseMetadata = response as unknown as { steps?: Step[] };
  const usedWebSearch = responseMetadata.steps && responseMetadata.steps.some((step) =>
    step.toolCalls && step.toolCalls.some((tc) => tc.toolName === "web_search")
  );

  console.log("✅ Web search OK");
  console.log(`📊 Resposta length: ${text.length} chars`);
  console.log(`🔗 Contém URLs: ${hasUrls ? "Sim" : "Não"}`);
  console.log(`📚 Número de sources: ${sources.length}`);
  console.log(`🔧 Usou web_search tool: ${usedWebSearch ? "Sim" : "Não"}`);

  if (process.env.VERBOSE) {
    console.log("\n--- Resposta completa ---");
    console.log(text);
    console.log("--- Fim da resposta ---\n");

    if (hasSources) {
      console.log("\n--- Sources ---");
      console.log(JSON.stringify(sources, null, 2));
      console.log("--- Fim sources ---\n");
    }

    if (responseMetadata.steps) {
      console.log("\n--- Steps metadata ---");
      console.log(JSON.stringify(responseMetadata.steps, null, 2));
      console.log("--- Fim steps ---\n");
    }
  }

  return { hasUrls, hasSources, usedWebSearch, sourcesCount: sources.length, responseLength: text.length };
}

async function main() {
  const basicResult = await testBasicConnection();
  const searchResult = await testWebSearchWithCitations();

  console.log(
    JSON.stringify(
      {
        success: true,
        model: basicResult.model,
        webSearch: {
          hasUrls: searchResult.hasUrls,
          hasSources: searchResult.hasSources,
          usedWebSearch: searchResult.usedWebSearch,
          sourcesCount: searchResult.sourcesCount,
          responseLength: searchResult.responseLength,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
