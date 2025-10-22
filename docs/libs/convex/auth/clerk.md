---
title: Clerk
url: 'https://docs.convex.dev/auth/clerk'
category: auth
section: authentication
fetched: true
last_updated: 2025-10-22T14:18:01.252Z
fetchedAt: '2025-10-22T14:29:32.232Z'
---
On this page

[Clerk](https://clerk.com) is an authentication platform providing login via passwords, social identity providers, one-time email or SMS access codes, and multi-factor authentication and user management.

## Get started[​](#get-started "Direct link to Get started")

Convex offers a provider that is specifically for integrating with Clerk called `<ConvexProviderWithClerk>`. It works with any of Clerk's React-based SDKs, such as the Next.js and Expo SDKs.

See the following sections for the Clerk SDK that you're using:

*   [React](#react) - Use this as a starting point if your SDK is not listed
*   [Next.js](#nextjs)
*   [Tanstack Start](#tanstack-start)

### React[​](#react "Direct link to React")

**Example:** [React with Convex and Clerk](https://github.com/get-convex/template-react-vite-clerk)

This guide assumes you already have a working React app with Convex. If not follow the [Convex React Quickstart](/quickstart/react) first. Then:

1.  Sign up for Clerk
    
    Sign up for a free Clerk account at [clerk.com/sign-up](https://dashboard.clerk.com/sign-up).
    
    ![Sign up to Clerk](/screenshots/clerk-signup.png)
    
2.  Create an application in Clerk
    
    Choose how you want your users to sign in.
    
    ![Create a Clerk application](/screenshots/clerk-createapp.png)
    
3.  Create a JWT Template
    
    In the Clerk Dashboard, navigate to the [JWT templates](https://dashboard.clerk.com/last-active?path=jwt-templates) page.
    
    Select *New template* and then from the list of templates, select *Convex*. You'll be redirected to the template's settings page. **Do NOT rename the JWT token. It must be called `convex`.**
    
    Copy and save the *Issuer* URL somewhere secure. This URL is the issuer domain for Clerk's JWT templates, which is your Clerk app's *Frontend API URL*. In development, it's format will be `https://verb-noun-00.clerk.accounts.dev`. In production, it's format will be `https://clerk.<your-domain>.com`.
    
    ![Create a JWT template](/screenshots/clerk-createjwt.png)
    
4.  Configure Convex with the Clerk issuer domain
    
    In your app's `convex` folder, create a new file `auth.config.ts` with the following code. This is the server-side configuration for validating access tokens.
    
    convex/auth.config.ts
    
    TS
    
    ```
    import { AuthConfig } from "convex/server";export default {  providers: [    {      // Replace with your own Clerk Issuer URL from your "convex" JWT template      // or with `process.env.CLERK_JWT_ISSUER_DOMAIN`      // and configure CLERK_JWT_ISSUER_DOMAIN on the Convex Dashboard      // See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,      applicationID: "convex",    },  ]} satisfies AuthConfig;
    ```
    
5.  Deploy your changes
    
    Run `npx convex dev` to automatically sync your configuration to your backend.
    
    ```
    npx convex dev
    ```
    
6.  Install clerk
    
    In a new terminal window, install the Clerk React SDK:
    
    ```
    npm install @clerk/clerk-react
    ```
    
7.  Set your Clerk API keys
    
    In the Clerk Dashboard, navigate to the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page. In the **Quick Copy** section, copy your Clerk Publishable Key and set it as the `CLERK_PUBLISHABLE_KEY` environment variable. If you're using Vite, you will need to prefix it with `VITE_`.
    
    .env
    
    ```
    VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
    ```
    
8.  Configure ConvexProviderWithClerk
    
    Both Clerk and Convex have provider components that are required to provide authentication and client context.
    
    You should already have `<ConvexProvider>` wrapping your app. Replace it with `<ConvexProviderWithClerk>`, and pass Clerk's `useAuth()` hook to it.
    
    Then, wrap it with `<ClerkProvider>`. `<ClerkProvider>` requires a `publishableKey` prop, which you can set to the `VITE_CLERK_PUBLISHABLE_KEY` environment variable.
    
    src/main.tsx
    
    TS
    
    ```
    import React from "react";import ReactDOM from "react-dom/client";import App from "./App";import "./index.css";import { ClerkProvider, useAuth } from "@clerk/clerk-react";import { ConvexProviderWithClerk } from "convex/react-clerk";import { ConvexReactClient } from "convex/react";const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);ReactDOM.createRoot(document.getElementById("root")!).render(  <React.StrictMode>    <ClerkProvider publishableKey="pk_test_...">      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>        <App />      </ConvexProviderWithClerk>    </ClerkProvider>  </React.StrictMode>,);
    ```
    
9.  Show UI based on authentication state
    
    You can control which UI is shown when the user is signed in or signed out using Convex's `<Authenticated>`, `<Unauthenticated>` and `<AuthLoading>` helper components. These should be used instead of Clerk's `<SignedIn>`, `<SignedOut>` and `<ClerkLoading>` components, respectively.
    
    It's important to use the [`useConvexAuth()`](/api/modules/react#useconvexauth) hook instead of Clerk's `useAuth()` hook when you need to check whether the user is logged in or not. The `useConvexAuth()` hook makes sure that the browser has fetched the auth token needed to make authenticated requests to your Convex backend, and that the Convex backend has validated it.
    
    In the following example, the `<Content />` component is a child of `<Authenticated>`, so its content and any of its child components are guaranteed to have an authenticated user, and Convex queries can require authentication.
    
    src/App.tsx
    
    TS
    
    ```
    import { SignInButton, UserButton } from "@clerk/clerk-react";import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";import { api } from "../convex/_generated/api";function App() {  return (    <main>      <Unauthenticated>        <SignInButton />      </Unauthenticated>      <Authenticated>        <UserButton />        <Content />      </Authenticated>      <AuthLoading>        <p>Still loading</p>      </AuthLoading>    </main>  );}function Content() {  const messages = useQuery(api.messages.getForCurrentUser);  return <div>Authenticated content: {messages?.length}</div>;}export default App;
    ```
    
10.  Use authentication state in your Convex functions
     
     If the client is authenticated, you can access the information stored in the JWT via `ctx.auth.getUserIdentity`.
     
     If the client isn't authenticated, `ctx.auth.getUserIdentity` will return `null`.
     
     **Make sure that the component calling this query is a child of `<Authenticated>` from `convex/react`**. Otherwise, it will throw on page load.
     
     convex/messages.ts
     
     TS
     
     ```
     import { query } from "./_generated/server";export const getForCurrentUser = query({  args: {},  handler: async (ctx) => {    const identity = await ctx.auth.getUserIdentity();    if (identity === null) {      throw new Error("Not authenticated");    }    return await ctx.db      .query("messages")      .filter((q) => q.eq(q.field("author"), identity.email))      .collect();  },});
     ```
     

### Next.js[​](#nextjs "Direct link to Next.js")

**Example:** [Next.js with Convex and Clerk](https://github.com/get-convex/template-nextjs-clerk)

This guide assumes you already have a working Next.js app with Convex. If not follow the [Convex Next.js Quickstart](/quickstart/nextjs) first. Then:

1.  Sign up for Clerk
    
    Sign up for a free Clerk account at [clerk.com/sign-up](https://dashboard.clerk.com/sign-up).
    
    ![Sign up to Clerk](/screenshots/clerk-signup.png)
    
2.  Create an application in Clerk
    
    Choose how you want your users to sign in.
    
    ![Create a Clerk application](/screenshots/clerk-createapp.png)
    
3.  Create a JWT Template
    
    In the Clerk Dashboard, navigate to the [JWT templates](https://dashboard.clerk.com/last-active?path=jwt-templates) page.
    
    Select *New template* and then from the list of templates, select *Convex*. You'll be redirected to the template's settings page. **Do NOT rename the JWT token. It must be called `convex`.**
    
    Copy and save the *Issuer* URL somewhere secure. This URL is the issuer domain for Clerk's JWT templates, which is your Clerk app's *Frontend API URL*. In development, it's format will be `https://verb-noun-00.clerk.accounts.dev`. In production, it's format will be `https://clerk.<your-domain>.com`.
    
    ![Create a JWT template](/screenshots/clerk-createjwt.png)
    
4.  Configure Convex with the Clerk issuer domain
    
    In your app's `convex` folder, create a new file `auth.config.ts` with the following code. This is the server-side configuration for validating access tokens.
    
    convex/auth.config.ts
    
    TS
    
    ```
    import { AuthConfig } from "convex/server";export default {  providers: [    {      // Replace with your own Clerk Issuer URL from your "convex" JWT template      // or with `process.env.CLERK_JWT_ISSUER_DOMAIN`      // and configure CLERK_JWT_ISSUER_DOMAIN on the Convex Dashboard      // See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,      applicationID: "convex",    },  ]} satisfies AuthConfig;
    ```
    
5.  Deploy your changes
    
    Run `npx convex dev` to automatically sync your configuration to your backend.
    
    ```
    npx convex dev
    ```
    
6.  Install clerk
    
    In a new terminal window, install the Clerk Next.js SDK:
    
    ```
    npm install @clerk/nextjs
    ```
    
7.  Set your Clerk API keys
    
    In the Clerk Dashboard, navigate to the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page. In the **Quick Copy** section, copy your Clerk Publishable and Secret Keys and set them as the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` environment variables, respectively.
    
    .env
    
    ```
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEYCLERK_SECRET_KEY=YOUR_SECRET_KEY
    ```
    
8.  Add Clerk middleware
    
    Clerk's `clerkMiddleware()` helper grants you access to user authentication state throughout your app.
    
    Create a `middleware.ts` file.
    
    In your `middleware.ts` file, export the `clerkMiddleware()` helper:
    
    ```
    import { clerkMiddleware } from '@clerk/nextjs/server'export default clerkMiddleware()export const config = {  matcher: [    // Skip Next.js internals and all static files, unless found in search params    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',    // Always run for API routes    '/(api|trpc)(.*)',  ],}
    ```
    
    By default, `clerkMiddleware()` will not protect any routes. All routes are public and you must opt-in to protection for routes.[https://clerk.com/docs/references/nextjs/clerk-middleware](https://clerk.com/docs/references/nextjs/clerk-middleware)) to learn how to require authentication for specific routes.
    
9.  Configure ConvexProviderWithClerk
    
    Both Clerk and Convex have provider components that are required to provide authentication and client context.
    
    Typically, you'd replace `<ConvexProvider>` with `<ConvexProviderWithClerk>`, but with Next.js App Router, things are a bit more complex.
    
    `<ConvexProviderWithClerk>` calls `ConvexReactClient()` to get Convex's client, so it must be used in a Client Component. Your `app/layout.tsx`, where you would use `<ConvexProviderWithClerk>`, is a Server Component, and a Server Component cannot contain Client Component code. To solve this, you must first create a *wrapper* Client Component around `<ConvexProviderWithClerk>`.
    
    ```
    'use client'import { ReactNode } from 'react'import { ConvexReactClient } from 'convex/react'import { ConvexProviderWithClerk } from 'convex/react-clerk'import { useAuth } from '@clerk/nextjs'if (!process.env.NEXT_PUBLIC_CONVEX_URL) {  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL in your .env file')}const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)export default function ConvexClientProvider({ children }: { children: ReactNode }) {  return (    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>      {children}    </ConvexProviderWithClerk>  )}
    ```
    
10.  Wrap your app in Clerk and Convex
     
     Now, your Server Component, `app/layout.tsx`, can render `<ConvexClientProvider>` instead of rendering `<ConvexProviderWithClerk>` directly. It's important that `<ClerkProvider>` wraps `<ConvexClientProvider>`, and not the other way around, as Convex needs to be able to access the Clerk context.
     
     ```
     import type { Metadata } from 'next'import { Geist, Geist_Mono } from 'next/font/google'import './globals.css'import { ClerkProvider } from '@clerk/nextjs'import ConvexClientProvider from '@/components/ConvexClientProvider'const geistSans = Geist({  variable: '--font-geist-sans',  subsets: ['latin'],})const geistMono = Geist_Mono({  variable: '--font-geist-mono',  subsets: ['latin'],})export const metadata: Metadata = {  title: 'Clerk Next.js Quickstart',  description: 'Generated by create next app',}export default function RootLayout({  children,}: Readonly<{  children: React.ReactNode}>) {  return (    <html lang="en">      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>        <ClerkProvider>          <ConvexClientProvider>{children}</ConvexClientProvider>        </ClerkProvider>      </body>    </html>  )}
     ```
     
11.  Show UI based on authentication state
     
     You can control which UI is shown when the user is signed in or signed out using Convex's `<Authenticated>`, `<Unauthenticated>` and `<AuthLoading>` helper components. These should be used instead of Clerk's `<SignedIn>`, `<SignedOut>` and `<ClerkLoading>` components, respectively.
     
     It's important to use the [`useConvexAuth()`](/api/modules/react#useconvexauth) hook instead of Clerk's `useAuth()` hook when you need to check whether the user is logged in or not. The `useConvexAuth()` hook makes sure that the browser has fetched the auth token needed to make authenticated requests to your Convex backend, and that the Convex backend has validated it.
     
     In the following example, the `<Content />` component is a child of `<Authenticated>`, so its content and any of its child components are guaranteed to have an authenticated user, and Convex queries can require authentication.
     
     app/page.tsx
     
     TS
     
     ```
     "use client";import { Authenticated, Unauthenticated } from "convex/react";import { SignInButton, UserButton } from "@clerk/nextjs";import { useQuery } from "convex/react";import { api } from "../convex/_generated/api";export default function Home() {  return (    <>      <Authenticated>        <UserButton />        <Content />      </Authenticated>      <Unauthenticated>        <SignInButton />      </Unauthenticated>    </>  );}function Content() {  const messages = useQuery(api.messages.getForCurrentUser);  return <div>Authenticated content: {messages?.length}</div>;}
     ```
     
12.  Use authentication state in your Convex functions
     
     If the client is authenticated, you can access the information stored in the JWT via `ctx.auth.getUserIdentity`.
     
     If the client isn't authenticated, `ctx.auth.getUserIdentity` will return `null`.
     
     **Make sure that the component calling this query is a child of `<Authenticated>` from `convex/react`**. Otherwise, it will throw on page load.
     
     convex/messages.ts
     
     TS
     
     ```
     import { query } from "./_generated/server";export const getForCurrentUser = query({  args: {},  handler: async (ctx) => {    const identity = await ctx.auth.getUserIdentity();    if (identity === null) {      throw new Error("Not authenticated");    }    return await ctx.db      .query("messages")      .filter((q) => q.eq(q.field("author"), identity.email))      .collect();  },});
     ```
     

### Tanstack Start[​](#tanstack-start "Direct link to Tanstack Start")

**Example:** [Tanstack Start with Convex and Clerk](https://github.com/get-convex/templates/tree/main/template-tanstack-start)

See the [Tanstack Start with Clerk guide](/client/tanstack/tanstack-start/clerk) for more information.

## Next steps[​](#next-steps "Direct link to Next steps")

### Accessing user information in functions[​](#accessing-user-information-in-functions "Direct link to Accessing user information in functions")

See [Auth in Functions](/auth/functions-auth) to learn about how to access information about the authenticated user in your queries, mutations and actions.

See [Storing Users in the Convex Database](/auth/database-auth) to learn about how to store user information in the Convex database.

### Accessing user information client-side[​](#accessing-user-information-client-side "Direct link to Accessing user information client-side")

To access the authenticated user's information, use Clerk's `User` object, which can be accessed using Clerk's [`useUser()`](https://clerk.com/docs/hooks/use-user) hook. For more information on the `User` object, see the [Clerk docs](https://clerk.com/docs/references/javascript/user).

components/Badge.tsx

TS

```
export default function Badge() {  const { user } = useUser();  return <span>Logged in as {user.fullName}</span>;}
```

## Configuring dev and prod instances[​](#configuring-dev-and-prod-instances "Direct link to Configuring dev and prod instances")

To configure a different Clerk instance between your Convex development and production deployments, you can use environment variables configured on the Convex dashboard.

### Configuring the backend[​](#configuring-the-backend "Direct link to Configuring the backend")

In the Clerk Dashboard, navigate to the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page. Copy your Clerk Frontend API URL. This URL is the issuer domain for Clerk's JWT templates, and is necessary for Convex to validate access tokens. In development, it's format will be `https://verb-noun-00.clerk.accounts.dev`. In production, it's format will be `https://clerk.<your-domain>.com`.

Paste your Clerk Frontend API URL into your `.env` file, set it as the `CLERK_JWT_ISSUER_DOMAIN` environment variable.

.env

```
CLERK_JWT_ISSUER_DOMAIN=https://verb-noun-00.clerk.accounts.dev
```

Then, update your `auth.config.ts` file to use the environment variable.

convex/auth.config.ts

TS

```
import { AuthConfig } from "convex/server";export default {  providers: [    {      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,      applicationID: "convex",    },  ],} satisfies AuthConfig;
```

**Development configuration**

In the left sidenav of the Convex [dashboard](https://dashboard.convex.dev), switch to your development deployment and set the values for your development Clerk instance.

![Convex dashboard dev deployment settings](/screenshots/clerk-convex-dashboard.png)

Then, to switch your deployment to the new configuration, run `npx convex dev`.

**Production configuration**

In the left sidenav of the Convex [dashboard](https://dashboard.convex.dev), switch to your production deployment and set the values for your production Clerk instance.

Then, to switch your deployment to the new configuration, run `npx convex deploy`.

### Configuring Clerk's API keys[​](#configuring-clerks-api-keys "Direct link to Configuring Clerk's API keys")

Clerk's API keys differ depending on whether they are for development or production. Don't forget to update the environment variables in your `.env` file as well as your hosting platform, such as Vercel or Netlify.

**Development configuration**

Clerk's Publishable Key for development follows the format `pk_test_...`.

.env.local

```
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
```

**Production configuration**

Clerk's Publishable Key for production follows the format `pk_live_...`.

.env

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
```

## Debugging authentication[​](#debugging-authentication "Direct link to Debugging authentication")

If a user goes through the Clerk login flow successfully, and after being redirected back to your page, `useConvexAuth()` returns `isAuthenticated: false`, it's possible that your backend isn't correctly configured.

The `auth.config.ts` file contains a list of configured authentication providers. You must run `npx convex dev` or `npx convex deploy` after adding a new provider to sync the configuration to your backend.

For more thorough debugging steps, see [Debugging Authentication](/auth/debug).

## Under the hood[​](#under-the-hood "Direct link to Under the hood")

The authentication flow looks like this under the hood:

1.  The user clicks a login button
2.  The user is redirected to a page where they log in via whatever method you configure in Clerk
3.  After a successful login Clerk redirects back to your page, or a different page which you configure via the [`afterSignIn`](https://clerk.com/docs/authentication/sign-in#override-ur-ls) prop.
4.  The `ClerkProvider` now knows that the user is authenticated.
5.  The `ConvexProviderWithClerk` fetches an auth token from Clerk.
6.  The `ConvexReactClient` passes this token down to your Convex backend to validate
7.  Your Convex backend retrieves the public key from Clerk to check that the token's signature is valid.
8.  The `ConvexReactClient` is notified of successful authentication, and `ConvexProviderWithClerk` now knows that the user is authenticated with Convex. `useConvexAuth` returns `isAuthenticated: true` and the `Authenticated` component renders its children.

`ConvexProviderWithClerk` takes care of refetching the token when needed to make sure the user stays authenticated with your backend.

*   [Get started](#get-started)
    *   [React](#react)
    *   [Next.js](#nextjs)
    *   [Tanstack Start](#tanstack-start)
*   [Next steps](#next-steps)
    *   [Accessing user information in functions](#accessing-user-information-in-functions)
    *   [Accessing user information client-side](#accessing-user-information-client-side)
*   [Configuring dev and prod instances](#configuring-dev-and-prod-instances)
    *   [Configuring the backend](#configuring-the-backend)
    *   [Configuring Clerk's API keys](#configuring-clerks-api-keys)
*   [Debugging authentication](#debugging-authentication)
*   [Under the hood](#under-the-hood)
