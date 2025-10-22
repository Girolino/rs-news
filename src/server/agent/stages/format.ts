import {
  formattedNewsItemSchema,
  type FormattedNewsItem,
  type StructuredNewsItem,
} from "@/types/news";
import { buildTelegramMessage } from "@/server/services/telegram/formatter";
import { logger } from "@/server/lib/logger";

export function runFormatStage(
  items: StructuredNewsItem[],
): FormattedNewsItem[] {
  const formatted: FormattedNewsItem[] = items.map((item) => {
    const messageHtml = buildTelegramMessage(item);
    return formattedNewsItemSchema.parse({
      ...item,
      messageHtml,
    });
  });
  logger.info("stage.format.complete", { count: formatted.length });
  return formatted;
}
