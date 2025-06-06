# Hono Auth0 Middleware

An Auth0 authentication middleware for [Hono](https://hono.dev) web framework. Built on top of the official [Auth0 SDK](https://www.npmjs.com/package/@auth0/auth0-server-js), this package provides a simple way to secure your Hono applications using Auth0 authentication.

## Installation

```bash
npm install hono-openid-connect
```

## Basic Usage

The simplest way to secure your Hono application is to implement the middleware at the application level. By default, all routes will require authentication.

```ts
import { Hono } from "hono";
import { auth } from "hono-openid-connect";

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

To use your own instance of [hono-sessions](https://www.npmjs.com/package/hono-sessions):

```ts
app.use(sessionMiddleware({}));
app.use(
  auth({
    // ...required options
    session: false,
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

You can catch `OIDCException` errors and handle them in your application. This is useful for logging or displaying custom error messages.

```js
import { OIDCException } from "hono-openid-connect";

app.onError((err, c) => {
  // Handle Auth0-specific errors
  if (err instanceof OIDCException) {
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

### Configuration thru environment variables

You can also configure the middleware using environment variables. The following environment variables are supported:

- AUTH0_DOMAIN: The issuer URL of the OpenID Connect provider (e.g., `auth.example.com`)
- AUTH0_CLIENT_ID: The client ID provided by your OIDC provider
- AUTH0_CLIENT_SECRET?: The client secret provided by your OIDC provider (required for most flows)
- BASE_URL: The base URL of your application (e.g., `https://myapp.com`)

In order to make the parameters of the middleware optional so you can use `auth({})`, your `process.env` must define the properties as follows:

```js
delcare global {
  namespace NodeJS {
    interface ProcessEnv {
      AUTH0_DOMAIN: string;
      AUTH0_CLIENT_ID: string;
      AUTH0_CLIENT_SECRET?: string;
      BASE_URL: string;
      AUTH0_SESSION_ENCRYPTION_KEY: string;
    }
  }
}
```

You automatically achieve this in Cloudflare's wrangler if you use:

```
  "compatibility_flags": [
    "nodejs_compat",
    "nodejs_compat_populate_process_env"
  ],
```

## Advanced Usage

### Selective Route Protection

Only protect specific routes:

```ts
import { Hono } from "hono";
import { auth, requiresAuth } from "hono-openid-connect";

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
import { auth, attemptSilentLogin } from "hono-openid-connect";

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
import { login } from "hono-openid-connect";

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

## Current Limitations

- **Backchannel Logout**: Unlike express-openid-connect, this middleware does not currently support backchannel logout.
- **JWT Response Mode**: Currently supports standard response modes but not JWT response mode.
- **Dynamic Client Registration**: Manual client registration is required.

## Context Variables

The middleware adds the following to the Hono context (`c.var`):

- `c.var.oidc.isAuthenticated`: Boolean indicating if the user is authenticated
- `c.var.oidc.claims`: All claims from the ID token
- `c.var.oidc.tokens`: The entire token exchange response:
  - `c.var.oidc.tokens.id_token`: Raw ID token
  - `c.var.oidc.tokens.access_token`: Access token (if available)
  - `c.var.oidc.tokens.refresh_token`: Refresh token (if available)
- `c.var.oidc.isExpired`: Boolean indicating if the access token is expired
- `c.var.oidc.fetchUserInfo()`: Fetches user info from the UserInfo endpoint.
- `c.var.oidc.refresh()`: Refreshes the access token using the refresh token (if available).
- `c.var.oidcClient`: The openid-client authorization server configuration object. This is helpful if you need to invoke a method of the openid-client directly.

## License

MIT 2025 - José F. Romaniello
