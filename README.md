# Hono Auth0 Middleware

An Auth0 authentication middleware for [Hono](https://hono.dev) web framework. Built on top of the official [Auth0 SDK](https://www.npmjs.com/package/@auth0/auth0-server-js), this package provides a simple way to secure your Hono applications using Auth0 authentication.

## Installation

```bash
npm install @auth0/auth0-hono
```

## Basic Usage

The simplest way to secure your Hono application is to implement the middleware at the application level. By default, all routes will require authentication.

```ts
import { Hono } from "hono";
import { auth } from "@auth0/auth0-hono";

const app = new Hono();

// Configure auth middleware with Auth0 options
app.use(
  auth({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    baseURL: process.env.BASE_URL,
    session: {
      secret: "password_at_least_32_characters_long",
    },
  }),
);

app.get("/", (c) => {
  return c.text(`Hello ${c.var.auth0Client?.getSession(c)?.user?.name}!`);
});

export default app;
```

## Features

- **Auth0 Authentication Flow**: Implements the Auth0 authorization code flow
- **Session Management**: Built-in session support with configurable cookie settings
- **Configurable Routes**: Customize login, callback, and logout route paths
- **Selective Protection**: Choose which routes require authentication with the `authRequired` option
- **Token Management**: Handles access tokens, ID tokens and refresh tokens
- **User Information**: Automatically fetches and provides user profile data
- **Claim-Based Authorization**: Middleware for authorizing based on claims from tokens
- **PKCE Support**: Implements Proof Key for Code Exchange for enhanced security
- **Environment Flexibility**: Works across various environments including Node.js, Bun, Cloudflare Workers, and more

## Configuration Options

### Required Configuration

| Option     | Type     | Description                                              |
| ---------- | -------- | -------------------------------------------------------- |
| `domain`   | `string` | Auth0 domain (e.g., `your-tenant.auth0.com`)             |
| `baseURL`  | `string` | Base URL of your application (e.g., `https://myapp.com`) |
| `clientID` | `string` | Client ID provided by Auth0                              |

### Optional Configuration

| Option                        | Type            | Default     | Description                                                                                                 |
| ----------------------------- | --------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `clientSecret`                | `string`        | `undefined` | Client Secret provided by Auth0 (required for most flows)                                                   |
| `authRequired`                | `boolean`       | `true`      | Whether authentication is required for all routes                                                           |
| `idpLogout`                   | `boolean`       | `false`     | Whether to perform logout at Auth0 when logging out locally                                                 |
| `pushedAuthorizationRequests` | `boolean`       | `false`     | Enable Pushed Authorization Requests (PAR)                                                                  |
| `customRoutes`                | `Array<string>` | `[]`        | Specify which built-in routes to skip (options: `'login'`, `'callback'`, `'logout'`, `'backchannelLogout'`) |
| `errorOnRequiredAuth`         | `boolean`       | `false`     | Return 401 if the user is not authenticated                                                                 |
| `attemptSilentLogin`          | `boolean`       | `false`     | Whether to attempt a silent login                                                                           |

### Routes Configuration

You can customize the paths for login, callback, logout, and backchannel logout endpoints:

```ts
app.use(
  auth({
    // ...required options
    routes: {
      login: "/custom-login",
      callback: "/auth-callback",
      logout: "/sign-out",
      backchannelLogout: "/backchannel-logout",
    },
  }),
);
```

### Session Configuration

The middleware uses [hono-sessions](https://www.npmjs.com/package/hono-sessions) for session management. You can configure session options or disable sessions entirely:

```ts
app.use(
  auth({
    // ...required options
    session: {
      secret: "your-secure-encryption-key-minimum-32-chars",
      sessionCookieName: "my_session",
      cookieOptions: {
        sameSite: "Lax",
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
    },
  }),
);
```

### Authorization Parameters

You can customize the parameters sent to the authorization endpoint:

```ts
app.use(
  auth({
    // ...required options
    authorizationParams: {
      response_type: "code",
      scope: "openid profile email",
      response_mode: "query",
    },
  }),
);
```

### Error handling

You can catch `Auth0Exception` errors and handle them in your application. This is useful for logging or displaying custom error messages.

```js
import { Auth0Exception } from "@auth0/auth0-hono";

app.onError((err, c) => {
  // Handle Auth0-specific errors
  if (err instanceof Auth0Exception) {
    console.log(err);
    if (process.env.NODE_ENV === "development") {
      return err.getResponse();
    }
    return c.text(`Authentication Error`, 500);
  }
  // Handle other errors
  return c.text(`Internal Server Error: ${err.message}`, 500);
});
```

### Configuration through Environment Variables

You can configure the middleware using environment variables instead of passing configuration options directly. This is particularly useful for deployment environments where you want to keep sensitive values in environment variables.

The following environment variables are supported:

| Environment Variable           | Required | Description                                                        |
| ------------------------------ | -------- | ------------------------------------------------------------------ |
| `AUTH0_DOMAIN`                 | Yes      | The Auth0 domain (e.g., `your-tenant.auth0.com`)                   |
| `AUTH0_CLIENT_ID`              | Yes      | The client ID provided by Auth0                                    |
| `BASE_URL`                     | Yes      | The base URL of your application (e.g., `https://myapp.com`)       |
| `AUTH0_CLIENT_SECRET`          | No       | The client secret provided by Auth0 (required for most flows)      |
| `AUTH0_AUDIENCE`               | No       | The API audience identifier for your Auth0 API                     |
| `AUTH0_SESSION_ENCRYPTION_KEY` | No       | The secret key used for session encryption (minimum 32 characters) |

When environment variables are set, they will be used as defaults for the corresponding configuration options. You can still override them by passing explicit values in the configuration object.

**Example using only environment variables:**

```bash
# .env file
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
BASE_URL=https://localhost:3000
AUTH0_SESSION_ENCRYPTION_KEY=your_32_character_minimum_secret_key
AUTH0_AUDIENCE=https://api.yourapp.com
```

```ts
import { Hono } from "hono";
import { auth } from "@auth0/auth0-hono";

const app = new Hono();

// No configuration object needed - will use environment variables
app.use(auth());

app.get("/", (c) => {
  return c.text(`Hello ${c.var.auth0Client?.getSession(c)?.user?.name}!`);
});
```

**Example with mixed configuration (environment + explicit):**

```ts
app.use(
  auth({
    // These will override environment variables if set
    authRequired: false,
    routes: {
      login: "/custom-login",
      callback: "/auth-callback",
    },
    // Other options like domain, clientID, etc. will use environment variables
  }),
);
```

## Advanced Usage

### Selective Route Protection

Only protect specific routes:

```ts
import { Hono } from "hono";
import { auth, requiresAuth } from "@auth0/auth0-hono";

const app = new Hono();

app.use(
  auth({
    // ...required options
    authRequired: false,
  }),
);

// Public route - no authentication required
app.get("/", (c) => {
  return c.text("This is a public page");
});

// Protected route - authentication required
app.use("/profile/*", requiresAuth());
app.get("/profile", (c) => {
  const user = c.var.oidc.user;
  return c.text(`Hello ${user.name || user.sub}!`);
});
```

### Silent Login Attempt

Try to authenticate silently without user interaction:

```ts
import { Hono } from "hono";
import { auth, attemptSilentLogin } from "@auth0/auth0-hono";

const app = new Hono();

app.use(
  auth({
    /* ...options */
    authRequired: false,
  }),
);

app.get("/", attemptSilentLogin(), async (c) => {
  if (c.var.oidc?.isAuthenticated) {
    return c.text(`Hello ${c.var.oidc.user.name}!`);
  }

  return c.text("You are not logged in");
});
```

### Advanced Login Options

The login middleware supports several advanced options:

```ts
import { login } from "@auth0/auth0-hono";

// Custom login options
app.get("/custom-login", async (c) => {
  return login({
    // Redirect user to this URL after successful authentication
    redirectAfterLogin: "/dashboard",

    // Additional authorization parameters to send to the identity provider
    authorizationParams: {
      prompt: "consent",
      acr_values: "level2",
      login_hint: "user@example.com",
    },

    // Forward specific query parameters from the login request to the authorization request
    forwardQueryParams: ["ui_locales", "login_hint", "campaign"],

    // Attempt silent authentication (no user interaction)
    silent: false,
  })(c);
});
```

With `forwardQueryParams`, you can pass query parameters from the login request to the authorization request. This is useful for:

- Passing UI locale preferences (`ui_locales`)
- Forwarding login hints to the identity provider
- Maintaining tracking parameters throughout the authentication flow
- Supporting custom parameters your identity provider accepts

## Feedback

### Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see the following:

- [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md)
- [Auth0's code of conduct guidelines](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md)

### Raise an issue

To provide feedback or report a bug, please [raise an issue on our issue tracker](https://github.com/auth0-lab/auth0-hono/issues).

### Vulnerability Reporting

Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/responsible-disclosure-policy) details the procedure for disclosing security issues.

---

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png"   width="150">
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_dark_mode.png" width="150">
    <img alt="Auth0 Logo" src="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png" width="150">
  </picture>
</p>
<p align="center">Auth0 is an easy to implement, adaptable authentication and authorization platform. To learn more checkout <a href="https://auth0.com/why-auth0">Why Auth0?</a></p>
<p align="center">
This project is licensed under the Apache 2.0 license. See the <a href="/LICENSE"> LICENSE</a> file for more info.</p>
