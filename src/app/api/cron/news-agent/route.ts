import { loadEnv } from "@/config/env";
import {
  AgentAlreadyRunningError,
  runNewsAgent,
} from "@/server/agent/orchestrator";
import { logger } from "@/server/lib/logger";

const env = loadEnv();

function isAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) {
    return true;
  }
  const header = request.headers.get("authorization");
  if (!header) return false;
  const [type, token] = header.split(" ");
  return type === "Bearer" && token === env.CRON_SECRET;
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runNewsAgent();
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AgentAlreadyRunningError) {
      return Response.json(
        { status: "skipped", reason: error.message },
        { status: 200 },
      );
    }
    logger.error("cron.news-agent.error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Internal Server Error", { status: 500 });
  }
}

export const POST = handleRequest;
export const GET = handleRequest;
