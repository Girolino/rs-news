---
title: Pagination
url: 'https://docs.convex.dev/database/pagination'
category: database
section: database
fetched: true
last_updated: 2025-10-22T14:18:01.250Z
fetchedAt: '2025-10-22T14:29:35.130Z'
---
On this page

Paginated queries are [queries](/functions/query-functions) that return a list of results in incremental pages.

This can be used to build components with "Load More" buttons or "infinite scroll" UIs where more results are loaded as the user scrolls.

**Example:** [Paginated Messaging App](https://github.com/get-convex/convex-demos/tree/main/pagination)

Using pagination in Convex is as simple as:

1.  Writing a paginated query function that calls [`.paginate(paginationOpts)`](/api/interfaces/server.OrderedQuery#paginate).
2.  Using the [`usePaginatedQuery`](/api/modules/react#usepaginatedquery) React hook.

Like other Convex queries, paginated queries are completely reactive.

## Writing paginated query functions[​](#writing-paginated-query-functions "Direct link to Writing paginated query functions")

Convex uses cursor-based pagination. This means that paginated queries return a string called a [`Cursor`](/api/modules/server#cursor) that represents the point in the results that the current page ended. To load more results, you simply call the query function again, passing in the cursor.

To build this in Convex, define a query function that:

1.  Takes in a single arguments object with a `paginationOpts` property of type [`PaginationOptions`](/api/interfaces/server.PaginationOptions).
    *   `PaginationOptions` is an object with `numItems` and `cursor` fields.
    *   Use `paginationOptsValidator` exported from `"convex/server"` to [validate](/functions/validation) this argument
    *   The arguments object may include properties as well.
2.  Calls [`.paginate(paginationOpts)`](/api/interfaces/server.OrderedQuery#paginate) on a [database query](/database/reading-data/), passing in the `PaginationOptions` and returning its result.
    *   The returned `page` in the [`PaginationResult`](/api/interfaces/server.PaginationResult) is an array of documents. You may [`map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) or [`filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) it before returning it.

convex/messages.ts

TS

```
import { v } from "convex/values";import { query, mutation } from "./_generated/server";import { paginationOptsValidator } from "convex/server";export const list = query({  args: { paginationOpts: paginationOptsValidator },  handler: async (ctx, args) => {    const foo = await ctx.db      .query("messages")      .order("desc")      .paginate(args.paginationOpts);    return foo;  },});
```

### Additional arguments[​](#additional-arguments "Direct link to Additional arguments")

You can define paginated query functions that take arguments in addition to `paginationOpts`:

convex/messages.ts

TS

```
export const listWithExtraArg = query({  args: { paginationOpts: paginationOptsValidator, author: v.string() },  handler: async (ctx, args) => {    return await ctx.db      .query("messages")      .filter((q) => q.eq(q.field("author"), args.author))      .order("desc")      .paginate(args.paginationOpts);  },});
```

### Transforming results[​](#transforming-results "Direct link to Transforming results")

You can apply arbitrary [transformations](/database/reading-data/#more-complex-queries) to the `page` property of the object returned by `paginate`, which contains the array of documents:

convex/messages.ts

TS

```
export const listWithTransformation = query({  args: { paginationOpts: paginationOptsValidator },  handler: async (ctx, args) => {    const results = await ctx.db      .query("messages")      .order("desc")      .paginate(args.paginationOpts);    return {      ...results,      page: results.page.map((message) => ({        author: message.author.slice(0, 1),        body: message.body.toUpperCase(),      })),    };  },});
```

## Paginating within React Components[​](#paginating-within-react-components "Direct link to Paginating within React Components")

To paginate within a React component, use the [`usePaginatedQuery`](/api/modules/react#usepaginatedquery) hook. This hook gives you a simple interface for rendering the current items and requesting more. Internally, this hook manages the continuation cursors.

The arguments to this hook are:

*   The name of the paginated query function.
*   The arguments object to pass to the query function, excluding the `paginationOpts` (that's injected by the hook).
*   An options object with the `initialNumItems` to load on the first page.

The hook returns an object with:

*   `results`: An array of the currently loaded results.
*   `isLoading` - Whether the hook is currently loading results.
*   `status`: The status of the pagination. The possible statuses are:
    *   `"LoadingFirstPage"`: The hook is loading the first page of results.
    *   `"CanLoadMore"`: This query may have more items to fetch. Call `loadMore` to fetch another page.
    *   `"LoadingMore"`: We're currently loading another page of results.
    *   `"Exhausted"`: We've paginated to the end of the list.
*   `loadMore(n)`: A callback to fetch more results. This will only fetch more results if the status is `"CanLoadMore"`.

src/App.tsx

TS

```
import { usePaginatedQuery } from "convex/react";import { api } from "../convex/_generated/api";export function App() {  const { results, status, loadMore } = usePaginatedQuery(    api.messages.list,    {},    { initialNumItems: 5 },  );  return (    <div>      {results?.map(({ _id, body }) => <div key={_id}>{body}</div>)}      <button onClick={() => loadMore(5)} disabled={status !== "CanLoadMore"}>        Load More      </button>    </div>  );}
```

You can also pass additional arguments in the arguments object if your function expects them:

src/App.tsx

TS

```
import { usePaginatedQuery } from "convex/react";import { api } from "../convex/_generated/api";export function App() {  const { results, status, loadMore } = usePaginatedQuery(    api.messages.listWithExtraArg,    { author: "Alex" },    { initialNumItems: 5 },  );  return (    <div>      {results?.map(({ _id, body }) => <div key={_id}>{body}</div>)}      <button onClick={() => loadMore(5)} disabled={status !== "CanLoadMore"}>        Load More      </button>    </div>  );}
```

### Reactivity[​](#reactivity "Direct link to Reactivity")

Like any other Convex query functions, paginated queries are **completely reactive**. Your React components will automatically rerender if items in your paginated list are added, removed or changed.

One consequence of this is that **page sizes in Convex may change!** If you request a page of 10 items and then one item is removed, this page may "shrink" to only have 9 items. Similarly if new items are added, a page may "grow" beyond its initial size.

## Paginating manually[​](#paginating-manually "Direct link to Paginating manually")

If you're paginating outside of React, you can manually call your paginated function multiple times to collect the items:

download.ts

TS

```
import { ConvexHttpClient } from "convex/browser";import { api } from "../convex/_generated/api";require("dotenv").config();const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);/** * Logs an array containing all messages from the paginated query "listMessages" * by combining pages of results into a single array. */async function getAllMessages() {  let continueCursor = null;  let isDone = false;  let page;  const results = [];  while (!isDone) {    ({ continueCursor, isDone, page } = await client.query(api.messages.list, {      paginationOpts: { numItems: 5, cursor: continueCursor },    }));    console.log("got", page.length);    results.push(...page);  }  console.log(results);}getAllMessages();
```

*   [Writing paginated query functions](#writing-paginated-query-functions)
    *   [Additional arguments](#additional-arguments)
    *   [Transforming results](#transforming-results)
*   [Paginating within React Components](#paginating-within-react-components)
    *   [Reactivity](#reactivity)
*   [Paginating manually](#paginating-manually)
