---
title: Environment Variables
url: 'https://docs.convex.dev/production/environment-variables'
category: production
section: production
fetched: true
last_updated: 2025-10-22T14:18:01.253Z
fetchedAt: '2025-10-22T14:29:43.297Z'
---
On this page

Environment variables are key-value pairs that are useful for storing values you wouldn't want to put in code or in a table, such as an API key. You can set environment variables in Convex through the dashboard, and you can access them in [functions](/functions) using `process.env`.

## Setting environment variables[​](#setting-environment-variables "Direct link to Setting environment variables")

Under [Deployment Settings](/dashboard/deployments/deployment-settings) in the Dashboard, you can see a list of environment variables in the current deployment. ![Environment Variables Table](/assets/images/environment_variables_table-1d215d0d797cca385b2c94dad4e938b4.png)

You can add up to 100 environment variables. Environment variable names cannot be more than 40 characters long, and they must start with a letter and only contain letters numbers, and underscores. Environment variable values cannot be larger than 8KB.

You can modify environment variables using the pencil icon button:

![Edit Environment Variable](/assets/images/edit_environment_variable-24411104aa164c750be92ce82fce3f50.png)

Environment variables can also be viewed and modified with the [command line](/cli#read-and-write-environment-variables).

```
npx convex env listnpx convex env set API_KEY secret-api-key
```

### Using environment variables in dev and prod deployments[​](#using-environment-variables-in-dev-and-prod-deployments "Direct link to Using environment variables in dev and prod deployments")

Since environment variables are set per-deployment, you can use different values for the same key in dev and prod deployments. This can be useful for when you have different external accounts you'd like to use depending on the environment. For example, you might have a dev and prod SendGrid account for sending emails, and your function expects an environment variable called `SENDGRID_API_KEY` that should work in both environments.

If you expect an environment variable to be always present in a function, you must add it to **all** your deployments. In this example, you would add an environment variable with the name `SENDGRID_API_KEY` to your dev and prod deployments, with a different value for dev and prod.

## Accessing environment variables[​](#accessing-environment-variables "Direct link to Accessing environment variables")

You can access environment variables in Convex functions using `process.env.KEY`. If the variable is set it is a `string`, otherwise it is `undefined`. Here is an example of accessing an environment variable with the key `GIPHY_KEY`:

```
function giphyUrl(query) {  return (    "https://api.giphy.com/v1/gifs/translate?api_key=" +    process.env.GIPHY_KEY +    "&s=" +    encodeURIComponent(query)  );}
```

Note that you should not condition your Convex function exports on environment variables. The set of Convex functions that can be called is determined during deployment and is not reevaluated when you change an environment variable. The following code will throw an error at runtime, if the DEBUG environment variable changes between deployment and calling the function.

```
// THIS WILL NOT WORK!export const myFunc = process.env.DEBUG ? mutation(...) : internalMutation(...);
```

Similarly, environment variables used in cron definitions will only be reevaluated on deployment.

## System environment variables[​](#system-environment-variables "Direct link to System environment variables")

The following environment variables are always available in Convex functions:

*   `CONVEX_CLOUD_URL` - Your deployment URL (eg. `https://dusty-nightingale-847.convex.cloud`) for use with Convex clients.
*   `CONVEX_SITE_URL` - Your deployment site URL (eg. `https://dusty-nightingale-847.convex.site`) for use with [HTTP Actions](/functions/http-actions)

## Project environment variable defaults[​](#project-environment-variable-defaults "Direct link to Project environment variable defaults")

You can set up default environment variable values for a project for development and preview deployments in Project Settings.

![Project Default Environment Variables](/assets/images/project_default_environment_variables-94be77c692d0a3c9564cb7f642b6cb64.png)

These default values will be used when creating a new development or preview deployment, and will have no effect on existing deployments (they are not kept in sync).

The Deployment Settings will indicate when a deployment has environment variables that do not match the project defaults. ![Environment Variable Default Mismatch](/assets/images/environment_variable_default_diff-0d02a2a8fe3f8d48d2437e0908421368.png)

*   [Setting environment variables](#setting-environment-variables)
    *   [Using environment variables in dev and prod deployments](#using-environment-variables-in-dev-and-prod-deployments)
*   [Accessing environment variables](#accessing-environment-variables)
*   [System environment variables](#system-environment-variables)
*   [Project environment variable defaults](#project-environment-variable-defaults)
