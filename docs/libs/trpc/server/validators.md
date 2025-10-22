---
title: Input Validation
url: 'https://trpc.io/docs/server/validators'
category: server
section: procedures
fetched: true
last_updated: 2025-10-22T14:17:58.145Z
fetchedAt: '2025-10-22T14:29:29.320Z'
---
Version: 11.x

On this page

tRPC procedures may define validation logic for their input and/or output, and validators are also used to infer the types of inputs and outputs (using the [Standard Schema](https://standardschema.dev) interface if available, or custom interfaces for supported validators if not). We have first class support for many popular validators, and you can [integrate validators](#contributing-your-own-validator-library) which we don't directly support.

## Input Validators[​](#input-validators "Direct link to Input Validators")

By defining an input validator, tRPC can check that a procedure call is correct and return a validation error if not.

To set up an input validator, use the `procedure.input()` method:

ts

``   // Our examples use Zod by default, but usage with other libraries is identical  import { z } from 'zod';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        z.object({          name: z.string(),        }),      )      .query((opts) => {        const name = opts.input.name;                 const name: string        return {          greeting: `Hello ${opts.input.name}`,        };      }),  });   ``

Copy

ts

``   // Our examples use Zod by default, but usage with other libraries is identical  import { z } from 'zod';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        z.object({          name: z.string(),        }),      )      .query((opts) => {        const name = opts.input.name;                 const name: string        return {          greeting: `Hello ${opts.input.name}`,        };      }),  });   ``

Copy

### Input Merging[​](#input-merging "Direct link to Input Merging")

`.input()` can be stacked to build more complex types, which is particularly useful when you want to utilise some common input to a collection of procedures in a [middleware](/docs/server/middlewares).

ts

``   const baseProcedure = t.procedure    .input(z.object({ townName: z.string() }))    .use((opts) => {      const input = opts.input;               const input: {     townName: string; }      console.log(`Handling request with user from: ${input.townName}`);      return opts.next();    });  export const appRouter = t.router({    hello: baseProcedure      .input(        z.object({          name: z.string(),        }),      )      .query((opts) => {        const input = opts.input;                 const input: {     townName: string;     name: string; }        return {          greeting: `Hello ${input.name}, my friend from ${input.townName}`,        };      }),  });   ``

Copy

ts

``   const baseProcedure = t.procedure    .input(z.object({ townName: z.string() }))    .use((opts) => {      const input = opts.input;               const input: {     townName: string; }      console.log(`Handling request with user from: ${input.townName}`);      return opts.next();    });  export const appRouter = t.router({    hello: baseProcedure      .input(        z.object({          name: z.string(),        }),      )      .query((opts) => {        const input = opts.input;                 const input: {     townName: string;     name: string; }        return {          greeting: `Hello ${input.name}, my friend from ${input.townName}`,        };      }),  });   ``

Copy

## Output Validators[​](#output-validators "Direct link to Output Validators")

Validating outputs is not always as important as defining inputs, since tRPC gives you automatic type-safety by inferring the return type of your procedures. Some reasons to define an output validator include:

*   Checking that data returned from untrusted sources is correct
*   Ensure that you are not returning more data to the client than necessary

info

If output validation fails, the server will respond with an `INTERNAL_SERVER_ERROR`.

ts

`   import { z } from 'zod';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .output(        z.object({          greeting: z.string(),        }),      )      .query((opts) => {        return {          gre,               *   greeting        };      }),  });   `

Copy

ts

`   import { z } from 'zod';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .output(        z.object({          greeting: z.string(),        }),      )      .query((opts) => {        return {          gre,               *   greeting        };      }),  });   `

Copy

### Output validation of subscriptions[​](#output-validation-of-subscriptions "Direct link to Output validation of subscriptions")

Since subscriptions are async iterators, you can use the same validation techniques as above.

Have a look at the [subscriptions guide](/docs/server/subscriptions#output-validation) for more information.

## The most basic validator: a function[​](#the-most-basic-validator-a-function "Direct link to The most basic validator: a function")

You can define a validator without any 3rd party dependencies, with a function.

info

We don't recommend making a custom validator unless you have a specific need, but it's important to understand that there's no magic here - it's *just typescript*!

In most cases we recommend you use a [validation library](#library-integrations)

ts

``   import { initTRPC } from '@trpc/server';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input((value): string => {        if (typeof value === 'string') {          return value;        }        throw new Error('Input is not a string');      })      .output((value): string => {        if (typeof value === 'string') {          return value;        }        throw new Error('Output is not a string');      })      .query((opts) => {        const { input } = opts;                   const input: string        return `hello ${input}`;      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input((value): string => {        if (typeof value === 'string') {          return value;        }        throw new Error('Input is not a string');      })      .output((value): string => {        if (typeof value === 'string') {          return value;        }        throw new Error('Output is not a string');      })      .query((opts) => {        const { input } = opts;                   const input: string        return `hello ${input}`;      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

## Library integrations[​](#library-integrations "Direct link to Library integrations")

tRPC works out of the box with a number of popular validation and parsing libraries, including any library conforming to [Standard Schema](https://standardschema.dev). The below are some examples of usage with validators which we officially maintain support for.

### With [Zod](https://github.com/colinhacks/zod)[​](#with-zod "Direct link to with-zod")

Zod is our default recommendation, it has a strong ecosystem which makes it a great choice to use in multiple parts of your codebase. If you have no opinion of your own and want a powerful library which won't limit future needs, Zod is a great choice.

ts

``   import { initTRPC } from '@trpc/server';  import { z } from 'zod';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        z.object({          name: z.string(),        }),      )      .output(        z.object({          greeting: z.string(),        }),      )      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import { z } from 'zod';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        z.object({          name: z.string(),        }),      )      .output(        z.object({          greeting: z.string(),        }),      )      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [Yup](https://github.com/jquense/yup)[​](#with-yup "Direct link to with-yup")

ts

``   import { initTRPC } from '@trpc/server';  import * as yup from 'yup';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        yup.object({          name: yup.string().required(),        }),      )      .output(        yup.object({          greeting: yup.string().required(),        }),      )      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import * as yup from 'yup';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        yup.object({          name: yup.string().required(),        }),      )      .output(        yup.object({          greeting: yup.string().required(),        }),      )      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [Superstruct](https://github.com/ianstormtaylor/superstruct)[​](#with-superstruct "Direct link to with-superstruct")

ts

``   import { initTRPC } from '@trpc/server';  import { object, string } from 'superstruct';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(object({ name: string() }))      .output(object({ greeting: string() }))      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import { object, string } from 'superstruct';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(object({ name: string() }))      .output(object({ greeting: string() }))      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [scale-ts](https://github.com/paritytech/scale-ts)[​](#with-scale-ts "Direct link to with-scale-ts")

ts

``   import { initTRPC } from '@trpc/server';  import * as $ from 'scale-codec';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input($.object($.field('name', $.str)))      .output($.object($.field('greeting', $.str)))      .query(({ input }) => {                   (parameter) input: {     readonly name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import * as $ from 'scale-codec';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input($.object($.field('name', $.str)))      .output($.object($.field('greeting', $.str)))      .query(({ input }) => {                   (parameter) input: {     readonly name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [Typia](https://typia.io/docs/utilization/trpc/)[​](#with-typia "Direct link to with-typia")

ts

`   import { initTRPC } from '@trpc/server';  import typia from 'typia';  import { v4 } from 'uuid';  import { IBbsArticle } from '../structures/IBbsArticle';  const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    store: publicProcedure      .input(typia.createAssert<IBbsArticle.IStore>())      .output(typia.createAssert<IBbsArticle>())      .query(({ input }) => {        return {          id: v4(),          writer: input.writer,          title: input.title,          body: input.body,          created_at: new Date().toString(),        };      }),  });  export type AppRouter = typeof appRouter;   `

Copy

ts

`   import { initTRPC } from '@trpc/server';  import typia from 'typia';  import { v4 } from 'uuid';  import { IBbsArticle } from '../structures/IBbsArticle';  const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    store: publicProcedure      .input(typia.createAssert<IBbsArticle.IStore>())      .output(typia.createAssert<IBbsArticle>())      .query(({ input }) => {        return {          id: v4(),          writer: input.writer,          title: input.title,          body: input.body,          created_at: new Date().toString(),        };      }),  });  export type AppRouter = typeof appRouter;   `

Copy

### With [ArkType](https://github.com/arktypeio/arktype#trpc)[​](#with-arktype "Direct link to with-arktype")

ts

``   import { initTRPC } from '@trpc/server';  import { type } from 'arktype';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure.input(type({ name: 'string' })).query((opts) => {      return {        greeting: `hello ${opts.input.name}`,      };    }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import { type } from 'arktype';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure.input(type({ name: 'string' })).query((opts) => {      return {        greeting: `hello ${opts.input.name}`,      };    }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [effect](https://github.com/Effect-TS/effect/tree/main/packages/schema)[​](#with-effect "Direct link to with-effect")

ts

``   import { initTRPC } from '@trpc/server';  import { Schema } from 'effect';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(Schema.standardSchemaV1(Schema.Struct({ name: Schema.String })))      .output(Schema.standardSchemaV1(Schema.Struct({ greeting: Schema.String })))      .query(({ input }) => {        //      ^?        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import { Schema } from 'effect';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(Schema.standardSchemaV1(Schema.Struct({ name: Schema.String })))      .output(Schema.standardSchemaV1(Schema.Struct({ greeting: Schema.String })))      .query(({ input }) => {        //      ^?        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [Valibot](https://github.com/fabian-hiller/valibot)[​](#with-valibot "Direct link to with-valibot")

ts

``   import { initTRPC } from '@trpc/server';  import * as v from 'valibot';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(v.object({ name: v.string() }))      .output(v.object({ greeting: v.string() }))      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { initTRPC } from '@trpc/server';  import * as v from 'valibot';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(v.object({ name: v.string() }))      .output(v.object({ greeting: v.string() }))      .query(({ input }) => {                   (parameter) input: {     name: string; }        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [@robolex/sure](https://github.com/robolex-app/public_ts)[​](#with-robolexsure "Direct link to with-robolexsure")

You're able to define your own Error types and error throwing function if necessary. As a convenience `@robolex/sure` provides [sure/src/err.ts](https://github.com/robolex-app/public_ts/blob/main/packages/sure/src/err.ts):

ts

`   // sure/src/err.ts  export const err = (schema) => (input) => {    const [good, result] = schema(input);    if (good) return result;    throw result;  };   `

Copy

ts

`   // sure/src/err.ts  export const err = (schema) => (input) => {    const [good, result] = schema(input);    if (good) return result;    throw result;  };   `

Copy

ts

``   import { err, object, string } from '@robolex/sure';  import { initTRPC } from '@trpc/server';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        err(          object({            name: string,          }),        ),      )      .output(        err(          object({            greeting: string,          }),        ),      )      .query(({ input }) => {        //      ^?        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { err, object, string } from '@robolex/sure';  import { initTRPC } from '@trpc/server';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(        err(          object({            name: string,          }),        ),      )      .output(        err(          object({            greeting: string,          }),        ),      )      .query(({ input }) => {        //      ^?        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

### With [TypeBox](https://github.com/sinclairzx81/typebox)[​](#with-typebox "Direct link to with-typebox")

ts

``   import { Type } from '@sinclair/typebox';  import { initTRPC } from '@trpc/server';  import { wrap } from '@typeschema/typebox';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(wrap(Type.Object({ name: Type.String() })))      .output(wrap(Type.Object({ greeting: Type.String() })))      .query(({ input }) => {        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

ts

``   import { Type } from '@sinclair/typebox';  import { initTRPC } from '@trpc/server';  import { wrap } from '@typeschema/typebox';  export const t = initTRPC.create();  const publicProcedure = t.procedure;  export const appRouter = t.router({    hello: publicProcedure      .input(wrap(Type.Object({ name: Type.String() })))      .output(wrap(Type.Object({ greeting: Type.String() })))      .query(({ input }) => {        return {          greeting: `hello ${input.name}`,        };      }),  });  export type AppRouter = typeof appRouter;   ``

Copy

## Contributing your own Validator Library[​](#contributing-your-own-validator-library "Direct link to Contributing your own Validator Library")

If you work on a validator library which supports tRPC usage, please feel free to open a PR for this page with equivalent usage to the other examples here, and a link to your docs.

Integration with tRPC in most cases is as simple as meeting one of several existing type interfaces. Conforming to [Standard Schema](https://standardschema.dev) is recommended, but in some cases we may accept a PR to add a new supported interface. Feel free to open an issue for discussion. You can check the existing supported interfaces and functions for parsing/validation [in code](https://github.com/trpc/trpc/blob/main/packages/server/src/unstable-core-do-not-import/parser.ts).

*   [Input Validators](#input-validators)
    *   [Input Merging](#input-merging)
*   [Output Validators](#output-validators)
    *   [Output validation of subscriptions](#output-validation-of-subscriptions)
*   [The most basic validator: a function](#the-most-basic-validator-a-function)
*   [Library integrations](#library-integrations)
    *   [With Zod](#with-zod)
    *   [With Yup](#with-yup)
    *   [With Superstruct](#with-superstruct)
    *   [With scale-ts](#with-scale-ts)
    *   [With Typia](#with-typia)
    *   [With ArkType](#with-arktype)
    *   [With effect](#with-effect)
    *   [With Valibot](#with-valibot)
    *   [With @robolex/sure](#with-robolexsure)
    *   [With TypeBox](#with-typebox)
*   [Contributing your own Validator Library](#contributing-your-own-validator-library)
