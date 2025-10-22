---
title: File Metadata
url: 'https://docs.convex.dev/file-storage/file-metadata'
category: file-storage
section: file-storage
fetched: true
last_updated: 2025-10-22T14:18:01.252Z
fetchedAt: '2025-10-22T14:29:38.837Z'
---
On this page

Every stored file is reflected as a document in the `"_storage"` system table. File metadata of a file can be accessed from [queries](/functions/query-functions) and [mutations](/functions/mutation-functions) via `db.system.get` and `db.system.query`:

convex/images.ts

TS

```
import { v } from "convex/values";import { query } from "./_generated/server";export const getMetadata = query({  args: {    storageId: v.id("_storage"),  },  handler: async (ctx, args) => {    return await ctx.db.system.get(args.storageId);  },});export const listAllFiles = query({  handler: async (ctx) => {    // You can use .paginate() as well    return await ctx.db.system.query("_storage").collect();  },});
```

This is an example of the returned document:

```
{  "_creationTime": 1700697415295.742,  "_id": "3k7ty84apk2zy00ay4st1n5p9kh7tf8",  "contentType": "image/jpeg",  "sha256": "cb58f529b2ed5a1b8b6681d91126265e919ac61fff6a367b8341c0f46b06a5bd",  "size": 125338}
```

The returned document has the following fields:

*   `sha256`: a base16 encoded sha256 checksum of the file contents
*   `size`: the size of the file in bytes
*   `contentType`: the `ContentType` of the file if it was provided on upload

You can check the metadata manually on your [dashboard](/dashboard/deployments/file-storage).

## Accessing metadata from actions (deprecated)[​](#accessing-metadata-from-actions-deprecated "Direct link to Accessing metadata from actions (deprecated)")

Alternatively, a [`storage.getMetadata()`](/api/interfaces/server.StorageReader#getmetadata) function is available to access individual file metadata from [actions](/functions/actions) and [HTTP actions](/functions/http-actions):

convex/images.ts

TS

```
import { v } from "convex/values";import { action } from "./_generated/server";export const getMetadata = action({  args: { storageId: v.id("_storage") },  handler: async (ctx, args) => {    return await ctx.storage.getMetadata(args.storageId);  },});
```

Note that [`storage.getMetadata()`](/api/interfaces/server.StorageReader#getmetadata) returns a [`FileMetadata`](/api/modules/server#filemetadata), which has a slightly different shape than the result from `db.system.get`.

*   [Accessing metadata from actions (deprecated)](#accessing-metadata-from-actions-deprecated)
