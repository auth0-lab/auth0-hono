import { assignFromEnv, parseConfiguration } from "@/config/index.js";
import { initializeOidcClient } from "@/lib/client.js";
import { OIDCEnv } from "@/lib/honoEnv.js";
import {
  backchannelLogout as backchannelLogoutHandler,
  callback as callbackHandler,
  login as loginHandler,
  logout as logoutHandler,
  requiresAuth,
} from "@/middleware/index.js";
import { ServerClient } from "@auth0/auth0-server-js";
import { Context, MiddlewareHandler, Next } from "hono";
import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { Configuration } from "./config/Configuration.js";
import { PartialConfig } from "./config/envConfig.js";
import { HonoCookieHandler } from "./session/HonoCookieHandler.js";

/**
 * Main auth middleware function.
 *
 * This function initializes the OIDC middleware with the provided configuration.
 * It sets up the session middleware if needed and handles the OIDC client initialization.
 * It also manages the routing for login, callback, and logout endpoints.
 *
 */
export function auth(initConfig: PartialConfig = {}): MiddlewareHandler {
  let client: ServerClient<Context>;
  let config: Configuration;
  // Main OIDC middleware function
  const oidcMiddleware: MiddlewareHandler = createMiddleware<OIDCEnv>(
    async (c, next: Next): Promise<Response | void> => {
      try {
        if (!client) {
          // Initialize the client
          const withEnvVars = assignFromEnv(initConfig, {
            ...c.env,
            ...(process.env ?? {}),
          });
          config = parseConfiguration(withEnvVars);
          client = initializeOidcClient(config);
        }
        c.set("auth0Client", client);
        c.set("auth0Configuration", config);

        // Use destructuring with defaults to ensure routes is always defined
        const { routes, authRequired, mountRoutes } = config;
        const { login, callback, logout, backchannelLogout } = routes;

        // Handle login route
        if (
          mountRoutes &&
          !config.customRoutes.includes("login") &&
          c.req.path === login &&
          c.req.method === "GET"
        ) {
          return loginHandler()(c, next);
        }

        // Handle callback route
        if (
          mountRoutes &&
          !config.customRoutes.includes("callback") &&
          c.req.path === callback
        ) {
          return callbackHandler()(c, next);
        }

        // Handle logout route
        if (
          mountRoutes &&
          !config.customRoutes.includes("logout") &&
          c.req.path === logout &&
          c.req.method === "GET"
        ) {
          return logoutHandler()(c, next);
        }

        // Handle backchannel logout route
        if (
          mountRoutes &&
          !config.customRoutes.includes("backchannelLogout") &&
          c.req.path === backchannelLogout &&
          c.req.method === "POST"
        ) {
          return backchannelLogoutHandler()(c, next);
        }

        // Handle unauthenticated requests
        if (authRequired) {
          return requiresAuth()(c, next);
        }
      } catch (error) {
        console.error("AUTH0 Middleware Error:", error);
        return c.text("Internal Server Error", 500);
      }
      // // Continue to the next middleware or route handler
      return await next();
    },
  );

  const setHonoContext = createMiddleware(async (c, next) => {
    return HonoCookieHandler.setContext(c, next);
  });

  return every(setHonoContext, oidcMiddleware);
}
