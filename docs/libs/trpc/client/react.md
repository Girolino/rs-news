---
title: React Query
url: 'https://trpc.io/docs/client/react'
category: client
section: client
fetched: true
last_updated: 2025-10-22T14:17:58.145Z
fetchedAt: '2025-10-22T14:29:20.507Z'
---
Version: 11.x

On this page

tip

These are the docs for our 'Classic' React Query integration, which (while still supported) is not the recommended way to start new tRPC projects with TanStack React Query. We recommend using the new [TanStack React Query Integration](/docs/client/tanstack-react-query/setup) instead.

tRPC offers a first class integration with React. Under the hood this is simply a wrapper around the very popular [@tanstack/react-query](https://tanstack.com/query/latest), so we recommend that you familiarise yourself with React Query, as their docs go in to much greater depth on its usage.

If you are using Next.js we recommend using [our integration with that](/docs/client/nextjs) instead.

❓ Do I have to use an integration?

No! The integration is fully optional. You can use `@tanstack/react-query` using just a [vanilla tRPC client](/docs/client/vanilla), although then you'll have to manually manage query keys and do not get the same level of DX as when using the integration package.

utils/trpc.ts

ts

`   export const trpc = createTRPCClient<AppRouter>({    links: [httpBatchLink({ url: 'YOUR_API_URL' })],  });   `

Copy

utils/trpc.ts

ts

`   export const trpc = createTRPCClient<AppRouter>({    links: [httpBatchLink({ url: 'YOUR_API_URL' })],  });   `

Copy

components/PostList.tsx

tsx

`   function PostList() {    const { data } = useQuery({      queryKey: ['posts'],      queryFn: () => trpc.post.list.query(),    });    data; // Post[]    // ...  }   `

Copy

components/PostList.tsx

tsx

`   function PostList() {    const { data } = useQuery({      queryKey: ['posts'],      queryFn: () => trpc.post.list.query(),    });    data; // Post[]    // ...  }   `

Copy

### The tRPC React Query Integration[​](#the-trpc-react-query-integration "Direct link to The tRPC React Query Integration")

This library enables usage directly within React components

pages/IndexPage.tsx

tsx

`   import { trpc } from '../utils/trpc';  export default function IndexPage() {    const helloQuery = trpc.hello.useQuery({ name: 'Bob' });    const goodbyeMutation = trpc.goodbye.useMutation();    return (      <div>        <p>{helloQuery.data?.greeting}</p>        <button onClick={() => goodbyeMutation.mutate()}>Say Goodbye</button>      </div>    );  }   `

Copy

pages/IndexPage.tsx

tsx

`   import { trpc } from '../utils/trpc';  export default function IndexPage() {    const helloQuery = trpc.hello.useQuery({ name: 'Bob' });    const goodbyeMutation = trpc.goodbye.useMutation();    return (      <div>        <p>{helloQuery.data?.greeting}</p>        <button onClick={() => goodbyeMutation.mutate()}>Say Goodbye</button>      </div>    );  }   `

Copy

### Differences to vanilla React Query[​](#differences-to-vanilla-react-query "Direct link to Differences to vanilla React Query")

The wrapper abstracts some aspects of React Query for you:

*   Query Keys - these are generated and managed by tRPC on your behalf, based on the procedure inputs you provide
    *   If you need the query key which tRPC calculates, you can use [getQueryKey](/docs/client/react/getQueryKey)
*   Type safe by default - the types you provide in your tRPC Backend also drive the types of your React Query client, providing safety throughout your React app

*   [The tRPC React Query Integration](#the-trpc-react-query-integration)
*   [Differences to vanilla React Query](#differences-to-vanilla-react-query)
