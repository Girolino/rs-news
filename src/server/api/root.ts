import { createTRPCRouter } from "@/server/api/trpc";
import { newsRouter } from "@/server/api/routers/news";

export const appRouter = createTRPCRouter({
  news: newsRouter,
});

export type AppRouter = typeof appRouter;
