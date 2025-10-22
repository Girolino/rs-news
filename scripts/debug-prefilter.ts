import { config } from "dotenv";
import { runDiscoveryStage } from "@/server/agent/stages/discovery";
import { runPrefilterStage } from "@/server/agent/stages/prefilter";

config({ path: ".env.local" });

async function main() {
  console.log("🔍 Running discovery...");
  const news = await runDiscoveryStage();
  console.log(`✅ Discovery found ${news.length} news\n`);

  if (news.length > 0) {
    const first = news[0];
    console.log("📰 First news item:");
    console.log("  ID:", first.id);
    console.log("  Title:", first.title);
    console.log("  URL:", first.url);
    console.log("  Source:", first.source);
    console.log("  PublishedAt:", first.publishedAt);
    console.log("  Body length:", first.body.length, "chars");
    console.log("  Body preview:", first.body.substring(0, 200));
    console.log();

    console.log("🔧 Testing prefilter with ALL news...");
    const result = runPrefilterStage(news);
    console.log("✅ Prefilter result:");
    console.log("  Passed:", result.items.length);
    console.log("  Discarded:", result.discarded);

    // Show why items were discarded
    console.log("\n🔍 Analyzing all news:");
    news.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.title.substring(0, 60)}...`);
      console.log("   PublishedAt:", item.publishedAt);
      console.log("   Body length:", item.body.length);

      // Check age
      const publishedDate = new Date(item.publishedAt);
      const now = new Date();
      const ageHours = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60);
      console.log("   Age:", ageHours.toFixed(1), "hours");
    });

    if (result.items.length > 0) {
      console.log("\n✅ First item passed!");
      console.log("  newsId:", result.items[0].newsId);
      console.log("  normalizedTitle:", result.items[0].normalizedTitle);
    } else {
      console.log("\n❌ First item was discarded!");
      console.log("\nDebugging why it was discarded:");

      // Check body length
      if (first.body.length < 100) {
        console.log("  ❌ Body too short:", first.body.length, "< 100");
      } else {
        console.log("  ✅ Body length OK:", first.body.length);
      }

      // Check age
      const publishedDate = new Date(first.publishedAt);
      const now = new Date();
      const ageHours = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60);
      if (ageHours > 12) {
        console.log("  ❌ Too old:", ageHours.toFixed(1), "hours > 12");
      } else {
        console.log("  ✅ Age OK:", ageHours.toFixed(1), "hours");
      }

      // Check Portuguese
      const sample = `${first.title} ${first.body.slice(0, 200)}`.toLowerCase();
      const stopwords = [" de ", " em ", " para ", " que ", " por ", " com ", " na ", " no ", " uma ", " um "];
      const hasStopword = stopwords.some(word => sample.includes(word));
      if (!hasStopword) {
        console.log("  ❌ Not Portuguese (no stopwords found)");
      } else {
        console.log("  ✅ Portuguese OK");
      }

      // Check keywords
      const content = `${first.title} ${first.body}`.toLowerCase();
      const keywords = ["b3", "ibovespa", "selic", "ipca", "petr", "vale", "resultado", "dividendo", "fusao", "aquisição", "companhia", "empresa", "lucro", "prejuízo", "balanço", "projeção", "economia", "inflacao", "inflação", "juros", "bc", "banco central"];
      const hasKeyword = keywords.some(keyword => content.includes(keyword));
      if (!hasKeyword) {
        console.log("  ❌ No keywords found");
        console.log("  Sample:", content.substring(0, 200));
      } else {
        console.log("  ✅ Keywords OK");
      }
    }
  }
}

main().catch(console.error);
