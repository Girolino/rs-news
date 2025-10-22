import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { runNewsAgent, AgentAlreadyRunningError } from "@/server/agent/orchestrator";

export const newsRouter = createTRPCRouter({
  runAgent: publicProcedure
    .input(
      z
        .object({
          force: z.boolean().default(false),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await runNewsAgent();
        return {
          status: "ok" as const,
          result,
        };
      } catch (error) {
        if (error instanceof AgentAlreadyRunningError && !input?.force) {
          return {
            status: "skipped" as const,
            reason: error.message,
          };
        }
        throw error;
      }
    }),
});
