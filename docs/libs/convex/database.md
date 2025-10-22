---
title: Database Basics
url: 'https://docs.convex.dev/database'
category: null
section: database
fetched: true
last_updated: 2025-10-22T14:18:01.250Z
fetchedAt: '2025-10-22T14:29:38.299Z'
---
The Convex database provides a relational data model, stores JSON-like documents, and can be used with or without a schema. It "just works," giving you predictable query performance in an easy-to-use interface.

Query and mutation [functions](/functions) read and write data through a lightweight JavaScript API. There is nothing to set up and no need to write any SQL. Just use JavaScript to express your app's needs.

Start by learning about the basics of [tables](#tables), [documents](#documents) and [schemas](#schemas) below, then move on to [Reading Data](/database/reading-data/) and [Writing Data](/database/writing-data).

As your app grows more complex you'll need more from your database:

*   Relational data modeling with [Document IDs](/database/document-ids)
*   Fast querying with [Indexes](/database/reading-data/indexes/)
*   Exposing large datasets with [Paginated Queries](/database/pagination)
*   Type safety by [Defining a Schema](/database/schemas)
*   Interoperability with data [Import & Export](/database/import-export/)

## Tables[​](#tables "Direct link to Tables")

Your Convex deployment contains tables that hold your app's data. Initially, your deployment contains no tables or documents.

Each table springs into existence as soon as you add the first document to it.

```
// `friends` table doesn't exist.await ctx.db.insert("friends", { name: "Jamie" });// Now it does, and it has one document.
```

You do not have to specify a schema upfront or create tables explicitly.

## Documents[​](#documents "Direct link to Documents")

Tables contain documents. Documents are very similar to JavaScript objects. They have fields and values, and you can nest arrays or objects within them.

These are all valid Convex documents:

```
{}{"name": "Jamie"}{"name": {"first": "Ari", "second": "Cole"}, "age": 60}
```

They can also contain references to other documents in other tables. See [Data Types](/database/types) to learn more about the types supported in Convex and [Document IDs](/database/document-ids) to learn about how to use those types to model your data.

## Schemas[​](#schemas "Direct link to Schemas")

Though optional, schemas ensure that your data looks exactly how you want. For a simple chat app, the schema will look like this:

```
import { defineSchema, defineTable } from "convex/server";import { v } from "convex/values";// @snippet start schemaexport default defineSchema({  messages: defineTable({    author: v.id("users"),    body: v.string(),  }),});
```

You can choose to be as flexible as you want by using types such as `v.any()` or as specific as you want by precisely describing a `v.object()`.

See [the schema documentation](/database/schemas) to learn more about schemas.

[

## Next: Reading Data

Query and read data from Convex database tables

](/database/reading-data)

Related posts from [](https://stack.convex.dev/)
