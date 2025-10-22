import { generateText, generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { loadEnv } from "@/config/env";
import {
  type DiscoveryNewsItem,
  discoveryNewsItemSchema,
} from "@/types/news";
import { logger } from "@/server/lib/logger";

// Schema para estruturar as notícias encontradas
const newsItemSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  summary: z.string(),
  publishedAt: z.string(),
  source: z.string(),
});

const structuredNewsSchema = z.object({
  news: z.array(newsItemSchema),
});

// Tópicos de busca para notícias brasileiras
const SEARCH_TOPICS = [
  "notícias empresas brasileiras B3 hoje",
  "resultados trimestrais empresas brasileiras",
  "Selic BCB decisão Copom",
  "IPCA inflação Brasil",
  "fusões aquisições empresas Brasil",
  "fatos relevantes B3 CVM",
];

// Domínios confiáveis para notícias financeiras Brasil
const DOMAIN_WHITELIST = [
  "valor.globo.com",
  "infomoney.com.br",
  "estadao.com.br",
  "ri.b3.com.br",
  "investidor10.com.br",
  "moneytimes.com.br",
  "broadcast.com.br",
  "reuters.com",
  "exame.com",
  "cvm.gov.br",
  "bcb.gov.br",
];

export async function runDiscoveryStage(): Promise<DiscoveryNewsItem[]> {
  logger.info("stage.discovery.start", {
    topics: SEARCH_TOPICS.length,
    whitelist: DOMAIN_WHITELIST.length,
  });

  const env = loadEnv();
  const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  try {
    // Step 1: Usa generateText com web search para coletar notícias
    const searchResult = await generateText({
      model: openai("gpt-5-mini"),
      system: [
        "Você é um agente especializado em curadoria de notícias financeiras do Brasil.",
        "Use a ferramenta de web search para encontrar notícias REAIS e ATUAIS (últimas 12-24 horas).",
        "Critérios de seleção:",
        "- Priorize notícias sobre empresas listadas na B3, indicadores macro (Selic, IPCA, PIB), e fatos relevantes (M&A, resultados, dividendos).",
        "- APENAS aceite notícias dos seguintes domínios confiáveis:",
        ...DOMAIN_WHITELIST.map((d) => `  * ${d}`),
        "",
        "Para cada notícia relevante, forneça:",
        "- Título completo",
        "- URL",
        "- Resumo de 1-2 linhas do conteúdo",
        "- Data de publicação (se disponível)",
        "- Fonte (domínio)",
      ].join("\n"),
      prompt: [
        "Execute buscas sobre os seguintes tópicos:",
        ...SEARCH_TOPICS.map((topic, i) => `${i + 1}. ${topic}`),
        "",
        "Para cada tópico, encontre 2-3 notícias mais relevantes das últimas 12-24 horas.",
        "Liste as notícias com todas as informações solicitadas.",
      ].join("\n"),
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: "high",
          userLocation: {
            type: "approximate",
            city: "São Paulo",
            region: "São Paulo",
            country: "BR",
          },
        }),
      },
      maxSteps: 8,
    });

    const searchText = searchResult.text;
    logger.info("stage.discovery.search_complete", {
      textLength: searchText.length,
    });

    // Step 2: Usa generateObject para estruturar os resultados
    const structureResult = await generateObject({
      model: openai("gpt-5-mini"),
      schema: structuredNewsSchema,
      system: [
        "Você deve extrair e estruturar notícias a partir do texto fornecido.",
        "Cada notícia deve conter: id, url, title, summary, publishedAt, source.",
        "Use timestamp ISO 8601 com timezone -03:00 para horário de Brasília.",
        "Se a data não estiver disponível, use a data/hora atual.",
        "O campo 'id' deve ser único (use hash ou últimos 12 chars da URL).",
      ].join("\n"),
      prompt: [
        "Extraia todas as notícias do seguinte texto e estruture-as no formato JSON:",
        "",
        searchText,
        "",
        "Retorne APENAS notícias que tenham URL válida e sejam dos domínios whitelist.",
        "Retorne entre 8-15 das notícias mais relevantes.",
      ].join("\n"),
    });

    const structured = structureResult.object;

    if (!structured || !structured.news || structured.news.length === 0) {
      logger.warn("stage.discovery.no_news_structured");
      return [];
    }

    logger.info("stage.discovery.object_structured", {
      newsCount: structured.news.length,
    });

    // Mapeia para o formato DiscoveryNewsItem
    const news: DiscoveryNewsItem[] = [];

    for (const item of structured.news) {
      try {
        // Valida se o domínio está na whitelist
        const urlObj = new URL(item.url);
        const domain = urlObj.hostname.replace("www.", "");

        if (!DOMAIN_WHITELIST.some((d) => domain.includes(d) || d.includes(domain))) {
          logger.debug("stage.discovery.domain_not_whitelisted", {
            url: item.url,
            domain,
          });
          continue;
        }

        const newsItem: DiscoveryNewsItem = {
          id: item.id,
          url: item.url,
          title: item.title,
          publishedAt: item.publishedAt,
          body: item.summary, // Usamos o summary como body inicial
          source: item.source,
        };

        // Valida com o schema
        discoveryNewsItemSchema.parse(newsItem);
        news.push(newsItem);
      } catch (error) {
        logger.warn("stage.discovery.invalid_item", {
          url: item.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("stage.discovery.complete", {
      total: news.length,
      structured: structured.news.length,
    });

    return news;
  } catch (error) {
    logger.error("stage.discovery.error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
