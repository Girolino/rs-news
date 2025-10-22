---
title: Introduction
url: 'https://trpc.io/docs/quickstart'
category: null
section: quickstart
fetched: true
last_updated: 2025-10-22T14:17:58.143Z
fetchedAt: '2025-10-22T14:29:21.430Z'
---
Version: 11.x

On this page

tRPC combines concepts from [REST](https://www.sitepoint.com/rest-api/) and [GraphQL](https://graphql.org/). If you are unfamiliar with either, take a look at the key [Concepts](/docs/concepts).

## Installation[​](#installation "Direct link to Installation")

tRPC is split between several packages, so you can install only what you need. Make sure to install the packages you want in the proper sections of your codebase. For this quickstart guide we'll keep it simple and use the vanilla client only. For framework guides, checkout [usage with React](/docs/client/tanstack-react-query/setup) and [usage with Next.js](/docs/client/nextjs/setup).

Requirements

*   tRPC requires TypeScript >=5.7.2
*   We strongly recommend you using `"strict": true` in your `tsconfig.json` as we don't officially support non-strict mode.

Start off by installing the `@trpc/server` and `@trpc/client` packages:

*   npm
*   yarn
*   pnpm
*   bun
*   deno

npm install @trpc/server @trpc/clientCopy

yarn add @trpc/server @trpc/clientCopy

pnpm add @trpc/server @trpc/clientCopy

bun add @trpc/server @trpc/clientCopy

deno add npm:@trpc/server npm:@trpc/clientCopy

## Defining a backend router[​](#defining-a-backend-router "Direct link to Defining a backend router")

Let's walk through the steps of building a typesafe API with tRPC. To start, this API will contain three endpoints with these TypeScript signatures:

ts

`   type User = { id: string; name: string; };  userList: () => User[];  userById: (id: string) => User;  userCreate: (data: { name: string }) => User;   `

Copy

ts

`   type User = { id: string; name: string; };  userList: () => User[];  userById: (id: string) => User;  userCreate: (data: { name: string }) => User;   `

Copy

### 1\. Create a router instance[​](#1-create-a-router-instance "Direct link to 1. Create a router instance")

First, let's initialize the tRPC backend. It's good convention to do this in a separate file and export reusable helper functions instead of the entire tRPC object.

server/trpc.ts

ts

`   import { initTRPC } from '@trpc/server';  /**   * Initialization of tRPC backend   * Should be done only once per backend!   */  const t = initTRPC.create();  /**   * Export reusable router and procedure helpers   * that can be used throughout the router   */  export const router = t.router;  export const publicProcedure = t.procedure;   `

Copy

server/trpc.ts

ts

`   import { initTRPC } from '@trpc/server';  /**   * Initialization of tRPC backend   * Should be done only once per backend!   */  const t = initTRPC.create();  /**   * Export reusable router and procedure helpers   * that can be used throughout the router   */  export const router = t.router;  export const publicProcedure = t.procedure;   `

Copy

Next, we'll initialize our main router instance, commonly referred to as `appRouter`, in which we'll later add procedures to. Lastly, we need to export the type of the router which we'll later use on the client side.

server/index.ts

ts

`   import { router } from './trpc';  const appRouter = router({    // ...  });  // Export type router type signature,  // NOT the router itself.  export type AppRouter = typeof appRouter;   `

Copy

server/index.ts

ts

`   import { router } from './trpc';  const appRouter = router({    // ...  });  // Export type router type signature,  // NOT the router itself.  export type AppRouter = typeof appRouter;   `

Copy

### 2\. Add a query procedure[​](#2-add-a-query-procedure "Direct link to 2. Add a query procedure")

Use `publicProcedure.query()` to add a query procedure to the router.

The following creates a query procedure called `userList` that returns a list of users from our database:

server/index.ts

ts

`   import { db } from './db';  import { publicProcedure, router } from './trpc';  const appRouter = router({    userList: publicProcedure      .query(async () => {        // Retrieve users from a datasource, this is an imaginary database        const users = await db.user.findMany();                 const users: User[]        return users;      }),  });   `

Copy

server/index.ts

ts

`   import { db } from './db';  import { publicProcedure, router } from './trpc';  const appRouter = router({    userList: publicProcedure      .query(async () => {        // Retrieve users from a datasource, this is an imaginary database        const users = await db.user.findMany();                 const users: User[]        return users;      }),  });   `

Copy

### 3\. Using input parser to validate procedure inputs[​](#3-using-input-parser-to-validate-procedure-inputs "Direct link to 3. Using input parser to validate procedure inputs")

To implement the `userById` procedure, we need to accept input from the client. tRPC lets you define [input parsers](/docs/server/validators) to validate and parse the input. You can define your own input parser or use a validation library of your choice, like [zod](https://zod.dev), [yup](https://github.com/jquense/yup), or [superstruct](https://docs.superstructjs.org/).

You define your input parser on `publicProcedure.input()`, which can then be accessed on the resolver function as shown below:

*   Vanilla
*   Zod
*   Yup
*   Valibot

The input parser should be a function that validates and casts the input of this procedure. It should return a strongly typed value when the input is valid or throw an error if the input is invalid.

  
  

server/index.ts

ts

``   const appRouter = router({    // ...    userById: publicProcedure      // The input is unknown at this time. A client could have sent      // us anything so we won't assume a certain data type.      .input((val: unknown) => {        // If the value is of type string, return it.        // It will now be inferred as a string.        if (typeof val === 'string') return val;        // Uh oh, looks like that input wasn't a string.        // We will throw an error instead of running the procedure.        throw new Error(`Invalid input: ${typeof val}`);      })      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   ``

Copy

server/index.ts

ts

``   const appRouter = router({    // ...    userById: publicProcedure      // The input is unknown at this time. A client could have sent      // us anything so we won't assume a certain data type.      .input((val: unknown) => {        // If the value is of type string, return it.        // It will now be inferred as a string.        if (typeof val === 'string') return val;        // Uh oh, looks like that input wasn't a string.        // We will throw an error instead of running the procedure.        throw new Error(`Invalid input: ${typeof val}`);      })      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   ``

Copy

The input parser can be any `ZodType`, e.g. `z.string()` or `z.object()`.

  
  

server.ts

ts

`   import { z } from 'zod';  const appRouter = router({    // ...    userById: publicProcedure      .input(z.string())      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   `

Copy

server.ts

ts

`   import { z } from 'zod';  const appRouter = router({    // ...    userById: publicProcedure      .input(z.string())      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   `

Copy

The input parser can be any `YupSchema`, e.g. `yup.string()` or `yup.object()`.

  
  

server.ts

ts

`   import * as yup from 'yup';  const appRouter = router({    // ...    userById: publicProcedure      .input(yup.string().required())      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   `

Copy

server.ts

ts

`   import * as yup from 'yup';  const appRouter = router({    // ...    userById: publicProcedure      .input(yup.string().required())      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   `

Copy

The input parser can be any Valibot schema, e.g. `v.string()` or `v.object()`.

  
  

server.ts

ts

`   import * as v from 'valibot';  const appRouter = router({    // ...    userById: publicProcedure      .input(v.string())      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   `

Copy

server.ts

ts

`   import * as v from 'valibot';  const appRouter = router({    // ...    userById: publicProcedure      .input(v.string())      .query(async (opts) => {        const { input } = opts;                   const input: string        // Retrieve the user with the given ID        const user = await db.user.findById(input);                 const user: User | undefined        return user;      }),  });   `

Copy

info

Throughout the remaining of this documentation, we will use `zod` as our validation library.

### 4\. Adding a mutation procedure[​](#4-adding-a-mutation-procedure "Direct link to 4. Adding a mutation procedure")

Similar to GraphQL, tRPC makes a distinction between query and mutation procedures.

The way a procedure works on the server doesn't change much between a query and a mutation. The method name is different, and the way that the client will use this procedure changes - but everything else is the same!

Let's add a `userCreate` mutation by adding it as a new property on our router object:

server.ts

ts

`   const appRouter = router({    // ...    userCreate: publicProcedure      .input(z.object({ name: z.string() }))      .mutation(async (opts) => {        const { input } = opts;                   const input: {     name: string; }        // Create a new user in the database        const user = await db.user.create(input);                 const user: {     name: string;     id: string; }        return user;      }),  });   `

Copy

server.ts

ts

`   const appRouter = router({    // ...    userCreate: publicProcedure      .input(z.object({ name: z.string() }))      .mutation(async (opts) => {        const { input } = opts;                   const input: {     name: string; }        // Create a new user in the database        const user = await db.user.create(input);                 const user: {     name: string;     id: string; }        return user;      }),  });   `

Copy

## Serving the API[​](#serving-the-api "Direct link to Serving the API")

Now that we have defined our router, we can serve it. tRPC has many [adapters](/docs/server/adapters) so you can use any backend framework of your choice. To keep it simple, we'll use the [`standalone`](/docs/server/adapters/standalone) adapter.

server/index.ts

ts

`   import { createHTTPServer } from '@trpc/server/adapters/standalone';  const appRouter = router({    // ...  });  const server = createHTTPServer({    router: appRouter,  });  server.listen(3000);   `

Copy

server/index.ts

ts

`   import { createHTTPServer } from '@trpc/server/adapters/standalone';  const appRouter = router({    // ...  });  const server = createHTTPServer({    router: appRouter,  });  server.listen(3000);   `

Copy

See the full backend code

server/db.ts

ts

`   type User = { id: string; name: string };  // Imaginary database  const users: User[] = [];  export const db = {    user: {      findMany: async () => users,      findById: async (id: string) => users.find((user) => user.id === id),      create: async (data: { name: string }) => {        const user = { id: String(users.length + 1), ...data };        users.push(user);        return user;      },    },  };   `

Copy

server/db.ts

ts

`   type User = { id: string; name: string };  // Imaginary database  const users: User[] = [];  export const db = {    user: {      findMany: async () => users,      findById: async (id: string) => users.find((user) => user.id === id),      create: async (data: { name: string }) => {        const user = { id: String(users.length + 1), ...data };        users.push(user);        return user;      },    },  };   `

Copy

  

server/trpc.ts

ts

`   import { initTRPC } from '@trpc/server';  const t = initTRPC.create();  export const router = t.router;  export const publicProcedure = t.procedure;   `

Copy

server/trpc.ts

ts

`   import { initTRPC } from '@trpc/server';  const t = initTRPC.create();  export const router = t.router;  export const publicProcedure = t.procedure;   `

Copy

  

server/index.ts

ts

`   import { createHTTPServer } from "@trpc/server/adapters/standalone";  import { z } from "zod";  import { db } from "./db";  import { publicProcedure, router } from "./trpc";  const appRouter = router({    userList: publicProcedure      .query(async () => {        const users = await db.user.findMany();        return users;      }),    userById: publicProcedure      .input(z.string())      .query(async (opts) => {        const { input } = opts;        const user = await db.user.findById(input);        return user;      }),    userCreate: publicProcedure      .input(z.object({ name: z.string() }))      .mutation(async (opts) => {        const { input } = opts;        const user = await db.user.create(input);        return user;      }),  });  export type AppRouter = typeof appRouter;  const server = createHTTPServer({    router: appRouter,  });  server.listen(3000);   `

Copy

server/index.ts

ts

`   import { createHTTPServer } from "@trpc/server/adapters/standalone";  import { z } from "zod";  import { db } from "./db";  import { publicProcedure, router } from "./trpc";  const appRouter = router({    userList: publicProcedure      .query(async () => {        const users = await db.user.findMany();        return users;      }),    userById: publicProcedure      .input(z.string())      .query(async (opts) => {        const { input } = opts;        const user = await db.user.findById(input);        return user;      }),    userCreate: publicProcedure      .input(z.object({ name: z.string() }))      .mutation(async (opts) => {        const { input } = opts;        const user = await db.user.create(input);        return user;      }),  });  export type AppRouter = typeof appRouter;  const server = createHTTPServer({    router: appRouter,  });  server.listen(3000);   `

Copy

## Using your new backend on the client[​](#using-your-new-backend-on-the-client "Direct link to Using your new backend on the client")

Let's now move to the client-side code and embrace the power of end-to-end typesafety. When we import the `AppRouter` type for the client to use, we have achieved full typesafety for our system without leaking any implementation details to the client.

### 1\. Setup the tRPC Client[​](#1-setup-the-trpc-client "Direct link to 1. Setup the tRPC Client")

client/index.ts

ts

``   import { createTRPCClient, httpBatchLink } from '@trpc/client';  import type { AppRouter } from './server';  //     👆 **type-only** import  // Pass AppRouter as generic here. 👇 This lets the `trpc` object know  // what procedures are available on the server and their input/output types.  const trpc = createTRPCClient<AppRouter>({    links: [      httpBatchLink({        url: 'http://localhost:3000',      }),    ],  });   ``

Copy

client/index.ts

ts

``   import { createTRPCClient, httpBatchLink } from '@trpc/client';  import type { AppRouter } from './server';  //     👆 **type-only** import  // Pass AppRouter as generic here. 👇 This lets the `trpc` object know  // what procedures are available on the server and their input/output types.  const trpc = createTRPCClient<AppRouter>({    links: [      httpBatchLink({        url: 'http://localhost:3000',      }),    ],  });   ``

Copy

Links in tRPC are similar to links in GraphQL, they let us control the data flow **before** being sent to the server. In the example above, we use the [httpBatchLink](/docs/client/links/httpBatchLink), which automatically batches up multiple calls into a single HTTP request. For more in-depth usage of links, see the [links documentation](/docs/client/links).

### 2\. Querying & mutating[​](#2-querying--mutating "Direct link to 2. Querying & mutating")

You now have access to your API procedures on the `trpc` object. Try it out!

client/index.ts

ts

`   // Inferred types  const user = await trpc.userById.query('1');           const user: {     name: string;     id: string; } | undefined  const createdUser = await trpc.userCreate.mutate({ name: 'sachinraja' });              const createdUser: {     name: string;     id: string; }   `

Copy

client/index.ts

ts

`   // Inferred types  const user = await trpc.userById.query('1');           const user: {     name: string;     id: string; } | undefined  const createdUser = await trpc.userCreate.mutate({ name: 'sachinraja' });              const createdUser: {     name: string;     id: string; }   `

Copy

### Full autocompletion[​](#full-autocompletion "Direct link to Full autocompletion")

You can open up your Intellisense to explore your API on your frontend. You'll find all of your procedure routes waiting for you along with the methods for calling them.

client/index.ts

ts

`   // Full autocompletion on your routes  trpc.u;          *   userById *   userCreate *   userList     `

Copy

client/index.ts

ts

`   // Full autocompletion on your routes  trpc.u;          *   userById *   userCreate *   userList     `

Copy

## Try it out for yourself![​](#try-it-out-for-yourself "Direct link to Try it out for yourself!")

## Next steps[​](#next-steps "Direct link to Next steps")

tip

We highly encourage you to check out [the example apps](/docs/example-apps) to learn about how tRPC is installed in your favorite framework.

tip

By default, tRPC will map complex types like `Date` to their JSON-equivalent *(`string` in the case of `Date`)*. If you want to add to retain the integrity of those types, the easiest way to add support for these is to [use superjson](/docs/server/data-transformers#using-superjson) as a Data Transformer.

tRPC includes more sophisticated client-side tooling designed for React projects and Next.js.

*   [Usage with Next.js](/docs/client/nextjs)
*   [Usage with Express (server-side)](/docs/server/adapters/express)
*   Usage with React (client-side)
    *   [React Integration (Recommended) -> `@trpc/tanstack-react-query`](/docs/client/tanstack-react-query/setup)
    *   [React Integration (Classic) -> `@trpc/react-query`](/docs/client/react)
    *   If you are unsure use `Recommended`

*   [Installation](#installation)
*   [Defining a backend router](#defining-a-backend-router)
    *   [1\. Create a router instance](#1-create-a-router-instance)
    *   [2\. Add a query procedure](#2-add-a-query-procedure)
    *   [3\. Using input parser to validate procedure inputs](#3-using-input-parser-to-validate-procedure-inputs)
    *   [4\. Adding a mutation procedure](#4-adding-a-mutation-procedure)
*   [Serving the API](#serving-the-api)
*   [Using your new backend on the client](#using-your-new-backend-on-the-client)
    *   [1\. Setup the tRPC Client](#1-setup-the-trpc-client)
    *   [2\. Querying & mutating](#2-querying--mutating)
    *   [Full autocompletion](#full-autocompletion)
*   [Try it out for yourself!](#try-it-out-for-yourself)
*   [Next steps](#next-steps)
