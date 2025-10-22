---
title: Metadata
url: 'https://trpc.io/docs/server/metadata'
category: server
section: advanced
fetched: true
last_updated: 2025-10-22T14:17:58.145Z
fetchedAt: '2025-10-22T14:29:24.699Z'
---
Version: 11.x

On this page

Procedure metadata allows you to add an optional procedure specific `meta` property which will be available in all [middleware](/docs/server/middlewares) function parameters.

tip

Use metadata together with [`trpc-openapi`](https://github.com/jlalmes/trpc-openapi) if you want to expose REST-compatible endpoints for your application.

## Create router with typed metadata[​](#create-router-with-typed-metadata "Direct link to Create router with typed metadata")

tsx

`   import { initTRPC } from '@trpc/server';  // [...]  interface Meta {    authRequired: boolean;  }  export const t = initTRPC.context<Context>().meta<Meta>().create();  export const appRouter = t.router({    // [...]  });   `

Copy

tsx

`   import { initTRPC } from '@trpc/server';  // [...]  interface Meta {    authRequired: boolean;  }  export const t = initTRPC.context<Context>().meta<Meta>().create();  export const appRouter = t.router({    // [...]  });   `

Copy

## Example with per route authentication settings[​](#example-with-per-route-authentication-settings "Direct link to Example with per route authentication settings")

server.ts

tsx

`   import { initTRPC } from '@trpc/server';  // [...]  interface Meta {    authRequired: boolean;  }  export const t = initTRPC.context<Context>().meta<Meta>().create();  export const authedProcedure = t.procedure.use(async (opts) => {    const { meta, next, ctx } = opts;    // only check authorization if enabled    if (meta?.authRequired && !ctx.user) {      throw new TRPCError({ code: 'UNAUTHORIZED' });    }    return next();  });  export const appRouter = t.router({    hello: authedProcedure.meta({ authRequired: false }).query(() => {      return {        greeting: 'hello world',      };    }),    protectedHello: authedProcedure.meta({ authRequired: true }).query(() => {      return {        greeting: 'hello-world',      };    }),  });   `

Copy

server.ts

tsx

`   import { initTRPC } from '@trpc/server';  // [...]  interface Meta {    authRequired: boolean;  }  export const t = initTRPC.context<Context>().meta<Meta>().create();  export const authedProcedure = t.procedure.use(async (opts) => {    const { meta, next, ctx } = opts;    // only check authorization if enabled    if (meta?.authRequired && !ctx.user) {      throw new TRPCError({ code: 'UNAUTHORIZED' });    }    return next();  });  export const appRouter = t.router({    hello: authedProcedure.meta({ authRequired: false }).query(() => {      return {        greeting: 'hello world',      };    }),    protectedHello: authedProcedure.meta({ authRequired: true }).query(() => {      return {        greeting: 'hello-world',      };    }),  });   `

Copy

## Default meta, chaining, and shallow merging[​](#default-meta-chaining-and-shallow-merging "Direct link to Default meta, chaining, and shallow merging")

You can set default values for your meta type, and if you chain meta on top of a base procedure it will be shallow merged.

tsx

`   import { initTRPC } from '@trpc/server';  interface Meta {    authRequired: boolean;    role?: 'user' | 'admin'  }  export const t = initTRPC    .context<Context>()    .meta<Meta>()    .create({      // Set a default value      defaultMeta: { authRequired: false }    });  const publicProcedure = t.procedure  // ^ Default Meta: { authRequired: false }  const authProcedure = publicProcedure    .use(authMiddleware)    .meta({      authRequired: true;      role: 'user'    });  // ^ Meta: { authRequired: true, role: 'user' }  const adminProcedure = authProcedure    .meta({      role: 'admin'    });  // ^ Meta: { authRequired: true, role: 'admin' }   `

Copy

tsx

`   import { initTRPC } from '@trpc/server';  interface Meta {    authRequired: boolean;    role?: 'user' | 'admin'  }  export const t = initTRPC    .context<Context>()    .meta<Meta>()    .create({      // Set a default value      defaultMeta: { authRequired: false }    });  const publicProcedure = t.procedure  // ^ Default Meta: { authRequired: false }  const authProcedure = publicProcedure    .use(authMiddleware)    .meta({      authRequired: true;      role: 'user'    });  // ^ Meta: { authRequired: true, role: 'user' }  const adminProcedure = authProcedure    .meta({      role: 'admin'    });  // ^ Meta: { authRequired: true, role: 'admin' }   `

Copy

*   [Create router with typed metadata](#create-router-with-typed-metadata)
*   [Example with per route authentication settings](#example-with-per-route-authentication-settings)
*   [Default meta, chaining, and shallow merging](#default-meta-chaining-and-shallow-merging)
