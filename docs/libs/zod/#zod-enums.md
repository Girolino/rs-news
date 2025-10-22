---
title: Enums
url: 'https://zod.dev/#zod-enums'
category: null
section: complex-types
fetched: true
last_updated: 2025-10-22T14:18:02.698Z
fetchedAt: '2025-10-22T14:29:45.604Z'
---
# Zod

TypeScript-first schema validation with static type inference  
by [@colinhacks](https://x.com/colinhacks)

  

[![Zod CI status](https://github.com/colinhacks/zod/actions/workflows/test.yml/badge.svg?event=push&branch=main)](https://github.com/colinhacks/zod/actions?query=branch%3Amain)[![Created by Colin McDonnell](https://img.shields.io/badge/created%20by-@colinhacks-4BBAAB.svg)](https://twitter.com/colinhacks)[![License](https://img.shields.io/github/license/colinhacks/zod)](https://opensource.org/licenses/MIT)[![npm](https://img.shields.io/npm/dw/zod.svg)](https://www.npmjs.com/package/zod)[![stars](https://img.shields.io/github/stars/colinhacks/zod)](https://github.com/colinhacks/zod)

[Website](https://zod.dev)  •  [Discord](https://discord.gg/RcG33DQJdf)  •  [𝕏](https://twitter.com/colinhacks)  •  [Bluesky](https://bsky.app/profile/zod.dev)  

  

Zod 4 is now stable! Read the [release notes here](/v4).

  
  
  

## Featured sponsor: Jazz

[

](https://jazz.tools/?utm_source=zod)

Interested in featuring? [Get in touch.](/cdn-cgi/l/email-protection#dcafacb3b2afb3aeafb4b5ac9cbfb3b0b5b2b4bdbfb7aff2bfb3b1)

## [Introduction](?id=introduction)

Zod is a TypeScript-first validation library. Using Zod, you can define *schemas* you can use to validate data, from a simple `string` to a complex nested object.

```
import * as z from "zod";
 
const User = z.object({
  name: z.string(),
});
 
// some untrusted data...
const input = { /* stuff */ };
 
// the parsed result is validated and type safe!
const data = User.parse(input);
 
// so you can use it with confidence :)
console.log(data.name);
```

## [Features](?id=features)

*   Zero external dependencies
*   Works in Node.js and all modern browsers
*   Tiny: 2kb core bundle (gzipped)
*   Immutable API: methods return a new instance
*   Concise interface
*   Works with TypeScript and plain JS
*   Built-in JSON Schema conversion
*   Extensive ecosystem

## [Installation](?id=installation)

```
npm install zod
```

Zod is also available as `@zod/zod` on [jsr.io](https://jsr.io/@zod/zod).

Zod provides an MCP server that can be used by agents to search Zod's docs. To add to your editor, follow [these instructions](https://share.inkeep.com/zod/mcp). Zod also provides an [llms.txt](https://zod.dev/llms.txt) file.

## [Requirements](?id=requirements)

Zod is tested against *TypeScript v5.5* and later. Older versions may work but are not officially supported.

### [`"strict"`](?id=strict)

You must enable `strict` mode in your `tsconfig.json`. This is a best practice for all TypeScript projects.

```
// tsconfig.json
{
  // ...
  "compilerOptions": {
    // ...
    "strict": true
  }
}
```

## [Ecosystem](?id=ecosystem)

Zod has a thriving ecosystem of libraries, tools, and integrations. Refer to the [Ecosystem page](/ecosystem) for a complete list of libraries that support Zod or are built on top of it.

*   [Resources](/ecosystem?id=resources)
*   [API Libraries](/ecosystem?id=api-libraries)
*   [Form Integrations](/ecosystem?id=form-integrations)
*   [Zod to X](/ecosystem?id=zod-to-x)
*   [X to Zod](/ecosystem?id=x-to-zod)
*   [Mocking Libraries](/ecosystem?id=mocking-libraries)
*   [Powered by Zod](/ecosystem?id=powered-by-zod)

I also contribute to the following projects, which I'd like to highlight:

*   [tRPC](https://trpc.io) - End-to-end typesafe APIs, with support for Zod schemas
*   [React Hook Form](https://react-hook-form.com) - Hook-based form validation with a [Zod resolver](https://react-hook-form.com/docs/useform#resolver)
*   [zshy](https://github.com/colinhacks/zshy) - Originally created as Zod's internal build tool. Bundler-free, batteries-included build tool for TypeScript libraries. Powered by `tsc`.

## [Sponsors](?id=sponsors)

Sponsorship at any level is appreciated and encouraged. If you built a paid product using Zod, consider one of the [corporate tiers](https://github.com/sponsors/colinhacks).

### [Platinum](?id=platinum)

[

](https://www.coderabbit.ai/)

Cut code review time & bugs in half

[coderabbit.ai](https://www.coderabbit.ai/)

  

### [Gold](?id=gold)

[](https://www.courier.com/?utm_source=zod&utm_campaign=osssponsors)

The API platform for sending notifications

[courier.com](https://www.courier.com/?utm_source=zod&utm_campaign=osssponsors)

[](https://liblab.com/?utm_source=zod)

Generate better SDKs for your APIs

[liblab.com](https://liblab.com/?utm_source=zod)

[](https://neon.tech)

Serverless Postgres — Ship faster

[neon.tech](https://neon.tech)

[](https://retool.com/?utm_source=github&utm_medium=referral&utm_campaign=zod)

Build AI apps and workflows with Retool AI

[retool.com](https://retool.com/?utm_source=github&utm_medium=referral&utm_campaign=zod)

[](https://stainlessapi.com)

Generate best-in-class SDKs

[stainlessapi.com](https://stainlessapi.com)

[](https://speakeasy.com/?utm_source=zod+docs)

SDKs & Terraform providers for your API

[speakeasy.com](https://speakeasy.com/?utm_source=zod+docs)

  

### [Silver](?id=silver)

[subtotal.com](https://www.subtotal.com/?utm_source=zod)

[juno.build](https://juno.build/?utm_source=zod)

[nitric.io](https://nitric.io/)

[propelauth.com](https://www.propelauth.com/)

[cerbos.dev](https://cerbos.dev/)

[scalar.com](https://scalar.com/)

[trigger.dev](https://trigger.dev)

[transloadit.com](https://transloadit.com/?utm_source=zod&utm_medium=referral&utm_campaign=sponsorship&utm_content=github)

[infisical.com](https://infisical.com)

[whop.com](https://whop.com/)

[cryptojobslist.com](https://cryptojobslist.com/)

[plain.com](https://plain.com/)

[inngest.com](https://inngest.com/)

[storyblok.com](https://storyblok.com/)

[mux.link/zod](https://mux.link/zod)

  

### [Bronze](?id=bronze)

[](https://www.val.town/)[val.town](https://www.val.town/)

[](https://www.route4me.com/)[route4me.com](https://www.route4me.com/)

[](https://encore.dev)[encore.dev](https://encore.dev)

[](https://www.replay.io/)[replay.io](https://www.replay.io/)

[](https://www.numeric.io)[numeric.io](https://www.numeric.io)

[](https://marcatopartners.com)[marcatopartners.com](https://marcatopartners.com)

[](https://interval.com)[interval.com](https://interval.com)

[](https://seasoned.cc)[seasoned.cc](https://seasoned.cc)

[](https://www.bamboocreative.nz/)[bamboocreative.nz](https://www.bamboocreative.nz/)

[](https://github.com/jasonLaster)[github.com/jasonLaster](https://github.com/jasonLaster)

[](https://www.clipboardhealth.com/engineering)[clipboardhealth.com/engineering](https://www.clipboardhealth.com/engineering)

  

[

Migration guide

Complete changelog and migration guide for upgrading from Zod 3 to Zod 4

](/v4/changelog)[

Basic usage

Basic usage guide covering schema definition, parsing data, error handling, and type inference

](/basics)

### On this page

[

Introduction](#introduction)[

Features](#features)[

Installation](#installation)[

Requirements](#requirements)[

`"strict"`](#strict)[

Ecosystem](#ecosystem)[

Sponsors](#sponsors)[

Platinum](#platinum)[

Gold](#gold)[

Silver](#silver)[

Bronze](#bronze)
