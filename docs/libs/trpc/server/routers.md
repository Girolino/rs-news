---
title: Routers
url: 'https://trpc.io/docs/server/routers'
category: server
section: server
fetched: true
last_updated: 2025-10-22T14:17:58.145Z
fetchedAt: '2025-10-22T14:29:29.321Z'
---
Version: 11.x

On this page

To begin building your tRPC-based API, you'll first need to define your router. Once you've mastered the fundamentals, you can [customize your routers](#advanced-usage) for more advanced use cases.

## Initialize tRPC[​](#initialize-trpc "Direct link to Initialize tRPC")

You should initialize tRPC **exactly once** per application. Multiple instances of tRPC will cause issues.

server/trpc.ts

ts

`   import { initTRPC } from '@trpc/server';  // You can use any variable name you like.  // We use t to keep things simple.  const t = initTRPC.create();  export const router = t.router;  export const publicProcedure = t.procedure;   `

Copy

server/trpc.ts

ts

`   import { initTRPC } from '@trpc/server';  // You can use any variable name you like.  // We use t to keep things simple.  const t = initTRPC.create();  export const router = t.router;  export const publicProcedure = t.procedure;   `

Copy

You'll notice we are exporting certain methods of the `t` variable here rather than `t` itself. This is to establish a certain set of procedures that we will use idiomatically in our codebase.

## Defining a router[​](#defining-a-router "Direct link to Defining a router")

Next, let's define a router with a procedure to use in our application. We have now created an API "endpoint".

In order for these endpoints to be exposed to the frontend, your [Adapter](/docs/server/adapters) should be configured with your `appRouter` instance.

server/\_app.ts

ts

`   import { publicProcedure, router } from './trpc';  const appRouter = router({    greeting: publicProcedure.query(() => 'hello tRPC v10!'),  });  // Export only the type of a router!  // This prevents us from importing server code on the client.  export type AppRouter = typeof appRouter;   `

Copy

server/\_app.ts

ts

`   import { publicProcedure, router } from './trpc';  const appRouter = router({    greeting: publicProcedure.query(() => 'hello tRPC v10!'),  });  // Export only the type of a router!  // This prevents us from importing server code on the client.  export type AppRouter = typeof appRouter;   `

Copy

## Advanced usage[​](#advanced-usage "Direct link to Advanced usage")

When initializing your router, tRPC allows you to:

*   Setup [request contexts](/docs/server/context)
*   Assign [metadata](/docs/server/metadata) to procedures
*   [Format](/docs/server/error-formatting) and [handle](/docs/server/error-handling) errors
*   [Transform data](/docs/server/data-transformers) as needed
*   Customize the [runtime configuration](#runtime-configuration)

You can use method chaining to customize your `t`\-object on initialization. For example:

ts

`   const t = initTRPC.context<Context>().meta<Meta>().create({    /* [...] */  });   `

Copy

ts

`   const t = initTRPC.context<Context>().meta<Meta>().create({    /* [...] */  });   `

Copy

### Runtime Configuration[​](#runtime-configuration "Direct link to Runtime Configuration")

ts

``   export interface RootConfig<TTypes extends RootTypes> {    /**     * Use a data transformer     * @see https://trpc.io/docs/v11/data-transformers     */    transformer: TTypes['transformer'];    /**     * Use custom error formatting     * @see https://trpc.io/docs/v11/error-formatting     */    errorFormatter: ErrorFormatter<TTypes['ctx'], any>;    /**     * Allow `@trpc/server` to run in non-server environments     * @warning **Use with caution**, this should likely mainly be used within testing.     * @default false     */    allowOutsideOfServer: boolean;    /**     * Is this a server environment?     * @warning **Use with caution**, this should likely mainly be used within testing.     * @default typeof window === 'undefined' || 'Deno' in window || process.env.NODE_ENV === 'test'     */    isServer: boolean;    /**     * Is this development?     * Will be used to decide if the API should return stack traces     * @default process.env.NODE_ENV !== 'production'     */    isDev: boolean;  }   ``

Copy

ts

``   export interface RootConfig<TTypes extends RootTypes> {    /**     * Use a data transformer     * @see https://trpc.io/docs/v11/data-transformers     */    transformer: TTypes['transformer'];    /**     * Use custom error formatting     * @see https://trpc.io/docs/v11/error-formatting     */    errorFormatter: ErrorFormatter<TTypes['ctx'], any>;    /**     * Allow `@trpc/server` to run in non-server environments     * @warning **Use with caution**, this should likely mainly be used within testing.     * @default false     */    allowOutsideOfServer: boolean;    /**     * Is this a server environment?     * @warning **Use with caution**, this should likely mainly be used within testing.     * @default typeof window === 'undefined' || 'Deno' in window || process.env.NODE_ENV === 'test'     */    isServer: boolean;    /**     * Is this development?     * Will be used to decide if the API should return stack traces     * @default process.env.NODE_ENV !== 'production'     */    isDev: boolean;  }   ``

Copy

*   [Initialize tRPC](#initialize-trpc)
*   [Defining a router](#defining-a-router)
*   [Advanced usage](#advanced-usage)
    *   [Runtime Configuration](#runtime-configuration)
