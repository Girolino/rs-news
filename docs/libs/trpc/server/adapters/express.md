---
title: Express Adapter
url: 'https://trpc.io/docs/server/adapters/express'
category: server/adapters
section: adapters
fetched: true
last_updated: 2025-10-22T14:17:58.146Z
fetchedAt: '2025-10-22T14:29:21.431Z'
---
Version: 11.x

On this page

## Example app[​](#example-app "Direct link to Example app")

Description

Links

Express server & procedure calls with Node.js.

*   [CodeSandbox](https://githubbox.com/trpc/trpc/tree/main/examples/express-server)
*   [Source](https://github.com/trpc/trpc/tree/main/examples/express-server)

## How to add tRPC to existing Express project[​](#how-to-add-trpc-to-existing-express-project "Direct link to How to add tRPC to existing Express project")

### 1\. Install deps[​](#1-install-deps "Direct link to 1. Install deps")

bash

`   yarn add @trpc/server zod   `

Copy

bash

`   yarn add @trpc/server zod   `

Copy

> [Zod](https://github.com/colinhacks/zod) isn't a required dependency, but it's used in the sample router below.

### 2\. Create a tRPC router[​](#2-create-a-trpc-router "Direct link to 2. Create a tRPC router")

Implement your tRPC router. A sample router is given below:

server.ts

ts

`   import { initTRPC } from '@trpc/server';  import { z } from 'zod';  export const t = initTRPC.create();  export const appRouter = t.router({    getUser: t.procedure.input(z.string()).query((opts) => {      opts.input; // string      return { id: opts.input, name: 'Bilbo' };    }),    createUser: t.procedure      .input(z.object({ name: z.string().min(5) }))      .mutation(async (opts) => {        // use your ORM of choice        return await UserModel.create({          data: opts.input,        });      }),  });  // export type definition of API  export type AppRouter = typeof appRouter;   `

Copy

server.ts

ts

`   import { initTRPC } from '@trpc/server';  import { z } from 'zod';  export const t = initTRPC.create();  export const appRouter = t.router({    getUser: t.procedure.input(z.string()).query((opts) => {      opts.input; // string      return { id: opts.input, name: 'Bilbo' };    }),    createUser: t.procedure      .input(z.object({ name: z.string().min(5) }))      .mutation(async (opts) => {        // use your ORM of choice        return await UserModel.create({          data: opts.input,        });      }),  });  // export type definition of API  export type AppRouter = typeof appRouter;   `

Copy

If your router file starts getting too big, split your router into several subrouters each implemented in its own file. Then [merge them](/docs/server/merging-routers) into a single root `appRouter`.

### 3\. Use the Express adapter[​](#3-use-the-express-adapter "Direct link to 3. Use the Express adapter")

tRPC includes an adapter for Express out of the box. This adapter lets you convert your tRPC router into an Express middleware.

server.ts

ts

`   import { initTRPC } from '@trpc/server';  import * as trpcExpress from '@trpc/server/adapters/express';  import express from 'express';  // created for each request  const createContext = ({    req,    res,  }: trpcExpress.CreateExpressContextOptions) => ({}); // no context  type Context = Awaited<ReturnType<typeof createContext>>;  const t = initTRPC.context<Context>().create();  const appRouter = t.router({    // [...]  });  const app = express();  app.use(    '/trpc',    trpcExpress.createExpressMiddleware({      router: appRouter,      createContext,    }),  );  app.listen(4000);   `

Copy

server.ts

ts

`   import { initTRPC } from '@trpc/server';  import * as trpcExpress from '@trpc/server/adapters/express';  import express from 'express';  // created for each request  const createContext = ({    req,    res,  }: trpcExpress.CreateExpressContextOptions) => ({}); // no context  type Context = Awaited<ReturnType<typeof createContext>>;  const t = initTRPC.context<Context>().create();  const appRouter = t.router({    // [...]  });  const app = express();  app.use(    '/trpc',    trpcExpress.createExpressMiddleware({      router: appRouter,      createContext,    }),  );  app.listen(4000);   `

Copy

Your endpoints are now available via HTTP!

Endpoint

HTTP URI

`getUser`

`GET http://localhost:4000/trpc/getUser?input=INPUT`  
  
where `INPUT` is a URI-encoded JSON string.

`createUser`

`POST http://localhost:4000/trpc/createUser`  
  
with `req.body` of type `{name: string}`

*   [Example app](#example-app)
*   [How to add tRPC to existing Express project](#how-to-add-trpc-to-existing-express-project)
    *   [1\. Install deps](#1-install-deps)
    *   [2\. Create a tRPC router](#2-create-a-trpc-router)
    *   [3\. Use the Express adapter](#3-use-the-express-adapter)
