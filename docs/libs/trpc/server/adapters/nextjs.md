---
title: Next.js Adapter
url: 'https://trpc.io/docs/server/adapters/nextjs'
category: server/adapters
section: adapters
fetched: true
last_updated: 2025-10-22T14:17:58.146Z
fetchedAt: '2025-10-22T14:29:22.894Z'
---
Version: 11.x

On this page

tip

tRPC's support for Next.js is far more expansive than just an adapter. This page covers a brief summary of how to set up the adapter, but complete documentation is [available here](/docs/client/nextjs)

## Example app[​](#example-app "Direct link to Example app")

Description

Links

Next.js Minimal Starter

*   [CodeSandbox](https://githubbox.com/trpc/trpc/tree/main/examples/next-minimal-starter)
*   [Source](https://github.com/trpc/trpc/tree/main/examples/next-minimal-starter)

## Next.js example[​](#nextjs-example "Direct link to Next.js example")

Serving your tRPC router in a Next.js project is straight-forward. Just create an API handler in `pages/api/trpc/[trpc].ts` as shown below:

pages/api/trpc/\[trpc\].ts

ts

`   import { createNextApiHandler } from '@trpc/server/adapters/next';  import { createContext } from '../../../server/trpc/context';  import { appRouter } from '../../../server/trpc/router/_app';  // @link https://nextjs.org/docs/api-routes/introduction  export default createNextApiHandler({    router: appRouter,    createContext,  });   `

Copy

pages/api/trpc/\[trpc\].ts

ts

`   import { createNextApiHandler } from '@trpc/server/adapters/next';  import { createContext } from '../../../server/trpc/context';  import { appRouter } from '../../../server/trpc/router/_app';  // @link https://nextjs.org/docs/api-routes/introduction  export default createNextApiHandler({    router: appRouter,    createContext,  });   `

Copy

## Handling CORS, and other Advanced usage[​](#handling-cors-and-other-advanced-usage "Direct link to Handling CORS, and other Advanced usage")

While you can usually just "set and forget" the API Handler as shown above, sometimes you might want to modify it further.

The API handler created by `createNextApiHandler` and equivalents in other frameworks is just a function that takes `req` and `res` objects. This means you can also modify those objects before passing them to the handler, for example to [enable CORS](/docs/client/cors).

pages/api/trpc/\[trpc\].ts

ts

`   import { createNextApiHandler } from '@trpc/server/adapters/next';  import { createContext } from '../../../server/trpc/context';  import { appRouter } from '../../../server/trpc/router/_app';  // create the API handler, but don't return it yet  const nextApiHandler = createNextApiHandler({    router: appRouter,    createContext,  });  // @link https://nextjs.org/docs/api-routes/introduction  export default async function handler(    req: NextApiRequest,    res: NextApiResponse,  ) {    // We can use the response object to enable CORS    res.setHeader('Access-Control-Allow-Origin', '*');    res.setHeader('Access-Control-Request-Method', '*');    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');    res.setHeader('Access-Control-Allow-Headers', '*');    // If you need to make authenticated CORS calls then    // remove what is above and uncomment the below code    // Allow-Origin has to be set to the requesting domain that you want to send the credentials back to    // res.setHeader('Access-Control-Allow-Origin', 'http://example:6006');    // res.setHeader('Access-Control-Request-Method', '*');    // res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');    // res.setHeader('Access-Control-Allow-Headers', 'content-type');    // res.setHeader('Referrer-Policy', 'no-referrer');    // res.setHeader('Access-Control-Allow-Credentials', 'true');    if (req.method === 'OPTIONS') {      res.writeHead(200);      return res.end();    }    // finally pass the request on to the tRPC handler    return nextApiHandler(req, res);  }   `

Copy

pages/api/trpc/\[trpc\].ts

ts

`   import { createNextApiHandler } from '@trpc/server/adapters/next';  import { createContext } from '../../../server/trpc/context';  import { appRouter } from '../../../server/trpc/router/_app';  // create the API handler, but don't return it yet  const nextApiHandler = createNextApiHandler({    router: appRouter,    createContext,  });  // @link https://nextjs.org/docs/api-routes/introduction  export default async function handler(    req: NextApiRequest,    res: NextApiResponse,  ) {    // We can use the response object to enable CORS    res.setHeader('Access-Control-Allow-Origin', '*');    res.setHeader('Access-Control-Request-Method', '*');    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');    res.setHeader('Access-Control-Allow-Headers', '*');    // If you need to make authenticated CORS calls then    // remove what is above and uncomment the below code    // Allow-Origin has to be set to the requesting domain that you want to send the credentials back to    // res.setHeader('Access-Control-Allow-Origin', 'http://example:6006');    // res.setHeader('Access-Control-Request-Method', '*');    // res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');    // res.setHeader('Access-Control-Allow-Headers', 'content-type');    // res.setHeader('Referrer-Policy', 'no-referrer');    // res.setHeader('Access-Control-Allow-Credentials', 'true');    if (req.method === 'OPTIONS') {      res.writeHead(200);      return res.end();    }    // finally pass the request on to the tRPC handler    return nextApiHandler(req, res);  }   `

Copy

## Route Handlers[​](#route-handlers "Direct link to Route Handlers")

If you're trying out the Next.js App Router and want to use [route handlers](https://beta.nextjs.org/docs/routing/route-handlers), you can do so by using the [fetch](/docs/server/adapters/fetch) adapter, as they build on web standard Request and Response objects:

app/api/trpc/\[trpc\]/route.ts

ts

`   import { fetchRequestHandler } from '@trpc/server/adapters/fetch';  import { appRouter } from '~/server/api/router';  function handler(req: Request) {    return fetchRequestHandler({      endpoint: '/api/trpc',      req,      router: appRouter,      createContext: () => ({ ... })    });  }  export { handler as GET, handler as POST };   `

Copy

app/api/trpc/\[trpc\]/route.ts

ts

`   import { fetchRequestHandler } from '@trpc/server/adapters/fetch';  import { appRouter } from '~/server/api/router';  function handler(req: Request) {    return fetchRequestHandler({      endpoint: '/api/trpc',      req,      router: appRouter,      createContext: () => ({ ... })    });  }  export { handler as GET, handler as POST };   `

Copy

*   [Example app](#example-app)
*   [Next.js example](#nextjs-example)
*   [Handling CORS, and other Advanced usage](#handling-cors-and-other-advanced-usage)
*   [Route Handlers](#route-handlers)
