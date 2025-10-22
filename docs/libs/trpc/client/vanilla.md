---
title: Vanilla Client
url: 'https://trpc.io/docs/client/vanilla'
category: client
section: client
fetched: true
last_updated: 2025-10-22T14:17:58.145Z
fetchedAt: '2025-10-22T14:29:20.507Z'
---
Version: 11.x

On this page

The "Vanilla" tRPC client can be used to call your API procedures as if they are local functions, enabling a seamless development experience.

ts

`   import type { AppRouter } from '../path/to/server/trpc';  const bilbo = await client.getUser.query('id_bilbo');  // => { id: 'id_bilbo', name: 'Bilbo' };   `

Copy

ts

`   import type { AppRouter } from '../path/to/server/trpc';  const bilbo = await client.getUser.query('id_bilbo');  // => { id: 'id_bilbo', name: 'Bilbo' };   `

Copy

### When to use the Vanilla Client?[​](#when-to-use-the-vanilla-client "Direct link to When to use the Vanilla Client?")

You are likely to use this client in two scenarios:

*   With a frontend framework for which we don't have an official integration
*   With a separate backend service written in TypeScript.

### When **NOT** to use the Vanilla Client?[​](#when-not-to-use-the-vanilla-client "Direct link to when-not-to-use-the-vanilla-client")

*   While you *can* use the client to call procedures from a React component, you should usually use our [React Query Integration](/docs/client/react). It offers many additional features such as the ability to manage loading and error state, caching, and invalidation.
*   We recommend you do not use this client when calling procedures of the same API instance, this is because the invocation has to pass through the network layer. For complete recommendations on invoking a procedure in the current API, you can [read more here](/docs/server/server-side-calls).

*   [When to use the Vanilla Client?](#when-to-use-the-vanilla-client)
*   [When **NOT** to use the Vanilla Client?](#when-not-to-use-the-vanilla-client)
