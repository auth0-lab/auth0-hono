import { ApiClient, VerifyAccessTokenError } from "@auth0/auth0-api-js";
import {
  InsufficientScopeError,
  InvalidTokenError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { ZodRawShape } from "zod";
import { MCP_TOOL_SCOPES } from "./tools";
import { Auth, Env, Variables } from "./types";

export interface Auth0McpOptions {
  resourceName: string;
  resourceServerUrl: URL;
  domain: string;
  audience: string;
}

export function auth0Mcp(options: Auth0McpOptions) {
  const a0Mcp = createAuth0Mcp(options);
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      // Handle OAuth metadata endpoint
      await a0Mcp.authMetadataHandler()(c, async () => {
        c.set("auth0Mcp", a0Mcp);
        await next();
      });
    },
  );
}

export function createAuth0Mcp(opts: Auth0McpOptions) {
  const verify = createVerifier({
    domain: opts.domain,
    audience: opts.audience,
  });
  const requireScopes = createScopeValidator();
  const authMiddleware = createAuthMiddleware(opts.resourceServerUrl, verify);
  const authMetadataHandler = createMcpAuthMetadataHandler({
    resourceName: opts.resourceName,
  });

  return {
    /**
     * Human-readable name for the protected resource (MCP server).
     */
    resourceName: opts.resourceName,

    /**
     * Wraps an MCP tool handler to enforce required OAuth scopes.
     *
     * @example
     * ```typescript
     * // Require specific scopes
     * export default requireScopes(["tool:greet"], async (params, { authInfo }) => {
     *   // Tool logic here
     * });
     *
     * // Authentication only (no scope validation)
     * export default requireScopes([], async (params, { authInfo }) => {
     *   // Tool logic here - just needs authenticated user
     * });
     */
    requireScopes,

    /**
     * Middleware for protecting MCP endpoints.
     * Validates Bearer tokens and sets auth info in the context.
     */
    authMiddleware: () => authMiddleware,

    /**
     * Middleware to serve OAuth Protected Resource Metadata at
     * `/.well-known/oauth-protected-resource` endpoint.
     */
    authMetadataHandler: () => authMetadataHandler,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Creates a JWT token verifier for Auth0-issued access tokens.
 *
 * This function returns a reusable `verify` function that validates JWT signatures,
 * token claims, and extracts user identity information for MCP integration using
 * the official @auth0/auth0-api-js library.
 */
function createVerifier({
  domain,
  audience,
}: {
  domain: string;
  audience: string;
}) {
  const apiClient = new ApiClient({
    domain,
    audience,
  });
  return async function verify(token: string): Promise<Auth> {
    try {
      const decoded = await apiClient.verifyAccessToken({
        accessToken: token,
      });

      if (!isNonEmptyString(decoded.sub)) {
        throw new InvalidTokenError(
          "Token is missing required subject (sub) claim",
        );
      }

      let clientId: string | null = null;
      if (isNonEmptyString(decoded.client_id)) {
        clientId = decoded.client_id;
      } else if (isNonEmptyString(decoded.azp)) {
        clientId = decoded.azp;
      }

      if (!clientId) {
        throw new InvalidTokenError(
          "Token is missing required client identification (client_id or azp claim).",
        );
      }

      return {
        token,
        clientId,
        scopes:
          typeof decoded.scope === "string"
            ? decoded.scope.split(" ").filter(Boolean)
            : [],
        ...(decoded.exp && { expiresAt: decoded.exp }),
        extra: {
          sub: decoded.sub,
          ...(isNonEmptyString(decoded.client_id) && {
            client_id: decoded.client_id,
          }),
          ...(isNonEmptyString(decoded.azp) && { azp: decoded.azp }),
          ...(isNonEmptyString(decoded.name) && { name: decoded.name }),
          ...(isNonEmptyString(decoded.email) && { email: decoded.email }),
        },
      };
    } catch (error) {
      if (error instanceof VerifyAccessTokenError) {
        throw new InvalidTokenError(error.message);
      }
      throw error;
    }
  };
}

/**
 * Returns a Hono middleware that protects MCP endpoints with Bearer token authentication.
 * This middleware validates Bearer tokens and sets auth info in the context.
 */
export function createAuthMiddleware(
  resourceServerUrl: URL,
  verifier: (token: string) => Promise<Auth>,
) {
  const resourceMetadataUrl =
    getOAuthProtectedResourceMetadataUrl(resourceServerUrl);

  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      try {
        const authHeader = c.req.header("Authorization");
        if (!authHeader) {
          throw new InvalidTokenError("Missing Authorization header");
        }

        const [type, token] = authHeader.split(" ");
        if (type.toLowerCase() !== "bearer" || !token) {
          throw new InvalidTokenError(
            "Invalid Authorization header format, expected 'Bearer TOKEN'",
          );
        }

        const authInfo = await verifier(token);

        // Set auth info in Hono context
        c.set("auth", authInfo);

        await next();
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          const wwwAuthValue = resourceMetadataUrl
            ? `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"`
            : `Bearer error="${error.errorCode}", error_description="${error.message}"`;

          throw new HTTPException(401, {
            res: c.json(error.toResponseObject(), 401, {
              "WWW-Authenticate": wwwAuthValue,
            }),
          });
        } else {
          // Handle any other errors as server errors
          const serverError = new ServerError("Internal Server Error");
          throw new HTTPException(500, {
            res: c.json(serverError.toResponseObject(), 500),
          });
        }
      }
    },
  );
}

/**
 * Wraps an MCP tool handler to enforce required OAuth scopes.
 *
 * This is a higher-order function that adds scope-based authorization to MCP tools.
 * It validates that the authenticated user's JWT token contains all required scopes
 * before allowing access to the wrapped tool.
 */
function createScopeValidator() {
  /**
   * Wraps a tool handler with scope validation.
   * This function ensures that the tool can only be executed if the user has the required OAuth scopes.
   */
  return function requireScopes<T extends ZodRawShape>(
    requiredScopes: readonly string[],
    handler: (args: T, extra: { authInfo: Auth }) => Promise<CallToolResult>,
  ): ToolCallback<T> {
    return (async (args, extra) => {
      // To support both context-only and payload+context handlers
      let context = extra;
      if (!extra) {
        context = args as Parameters<ToolCallback<T>>[1];
      }

      if (!context.authInfo) {
        throw new Error(
          "Authentication information is required to execute this tool.",
        );
      }
      const userScopes = context.authInfo.scopes;
      const hasScopes = requiredScopes.every((scope) =>
        userScopes.includes(scope),
      );

      if (!hasScopes) {
        throw new InsufficientScopeError(
          `Missing required scopes: ${requiredScopes.join(", ")}`,
        );
      }

      return handler(args as T, { authInfo: context.authInfo as Auth });
    }) as ToolCallback<T>;
  };
}

/**
 * Middleware to serve OAuth Protected Resource Metadata
 */
function createMcpAuthMetadataHandler({
  resourceName,
}: {
  resourceName: string;
}) {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      if (
        c.req.path === "/.well-known/oauth-protected-resource" &&
        c.req.method === "GET"
      ) {
        const { MCP_SERVER_URL, AUTH0_DOMAIN } = c.env;

        // TODO: Use PRM class to serve up once available: https://github.com/auth0/auth0-auth-js/pull/60
        const protectedResource: OAuthProtectedResourceMetadata = {
          resource: MCP_SERVER_URL as string,
          authorization_servers: [`https://${AUTH0_DOMAIN}/`],
          scopes_supported: ["openid", "profile", "email", ...MCP_TOOL_SCOPES],
          resource_name: resourceName,
          jwks_uri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
        };
        return c.json(protectedResource);
      }

      await next();
    },
  );
}
