import { citationSchema } from "@/types/news";

export function validateCitations(
  bullets: string[],
  citations: Array<unknown>,
): void {
  const parsedCitations = citations.map((citation) => citationSchema.parse(citation));
  const bulletCitationCount = new Array(bullets.length).fill(0);
  for (const citation of parsedCitations) {
    if (citation.associatedBullet < 0 || citation.associatedBullet >= bullets.length) {
      throw new Error(
        `Citation associatedBullet ${citation.associatedBullet} out of range`,
      );
    }
    bulletCitationCount[citation.associatedBullet] += 1;
  }
  const missingIndex = bulletCitationCount.findIndex((count) => count === 0);
  if (missingIndex !== -1) {
    throw new Error(`Bullet ${missingIndex} is missing citations`);
  }
}
