import { z } from "zod";
import { SessionStore } from "../types/session.js";

const isHttps = /^https:/i;

// Helper method to create response type/mode schema with proper dependencies
const createAuthParamsSchema = () => {
  return z
    .object({
      response_type: z
        .enum(["id_token", "code id_token", "code"])
        .optional()
        .default("code"),
      scope: z
        .string()
        .regex(/\bopenid\b/, "Must contain openid")
        .optional()
        .default("openid profile email"),
      response_mode: z.string().optional(),
    })
    .passthrough();
};

// Create the configuration schema
export const ConfigurationSchema = z
  .object({
    sessionStore: z.instanceof(SessionStore).optional(),
    session: z.object({
      store: z.any().optional(),
      encryptionKey: z.string().min(32),
      rolling: z.boolean().optional().default(true),
      absoluteDuration: z
        .number()
        .optional()
        .default(60 * 60 * 24 * 3),
      inactivityDuration: z
        .number()
        .optional()
        .default(60 * 60 * 24),
      cookieOptions: z
        .object({
          name: z.string().optional().default("appSession"),
          sameSite: z.enum(["lax", "strict", "none"]).optional().default("lax"),
          secure: z.boolean().optional(),
        })
        .optional()
        .default({
          name: "appSession",
          sameSite: "lax",
        }),
    }),
    tokenEndpointParams: z.record(z.any()).optional(),
    authorizationParams: createAuthParamsSchema().optional().default({}),
    forwardAuthorizationParams: z.array(z.string()).optional().default([]),
    logoutParams: z.record(z.any()).optional(),
    baseURL: z.string().url(),
    clientID: z.string(),
    clientSecret: z.string().optional(),
    clockTolerance: z.number().optional().default(60),
    enableTelemetry: z.boolean().optional().default(true),
    errorOnRequiredAuth: z.boolean().optional().default(false),
    attemptSilentLogin: z.boolean().optional().default(false),
    excludedClaims: z
      .array(z.string())
      .optional()
      .default([
        "aud",
        "iss",
        "iat",
        "exp",
        "nbf",
        "nonce",
        "azp",
        "auth_time",
        "s_hash",
        "at_hash",
        "c_hash",
      ]),
    idpLogout: z.boolean().optional().default(false),
    idTokenSigningAlg: z
      .string()
      .refine((val) => val.toLowerCase() !== "none", {
        message: "Signing algorithm cannot be 'none'",
      })
      .optional()
      .default("RS256"),
    domain: z
      .string()
      .regex(
        /^(?=.{1,253}$)(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.)*(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/,
      ),
    authRequired: z.boolean().optional().default(true),
    pushedAuthorizationRequests: z.boolean().optional().default(false),
    customRoutes: z
      .array(z.enum(["login", "callback", "logout"]))
      .optional()
      .default([]),
    debug: z
      .custom<(message: string, metadata?: Record<string, unknown>) => void>(
        (v) => typeof v === "function",
      )
      .optional()
      .default(() => () => {}),
    routes: z
      .object({
        login: z.string().regex(/^\//).optional().default("/login"),
        logout: z.string().regex(/^\//).optional().default("/logout"),
        callback: z.string().regex(/^\//).optional().default("/callback"),
      })
      .optional()
      .default({}),
    clientAuthMethod: z
      .enum([
        "client_secret_basic",
        "client_secret_post",
        "client_secret_jwt",
        "private_key_jwt",
        "none",
      ])
      .optional(),
    clientAssertionSigningKey: z.any().optional(),
    clientAssertionSigningAlg: z
      .enum([
        "RS256",
        "RS384",
        "RS512",
        "PS256",
        "PS384",
        "PS512",
        "ES256",
        "ES256K",
        "ES384",
        "ES512",
        "EdDSA",
      ])
      .optional(),
    discoveryCacheMaxAge: z
      .number()
      .min(0)
      .optional()
      .default(10 * 60 * 1000),
    httpTimeout: z.number().min(500).optional().default(5000),
    httpUserAgent: z.string().optional().default("hono-openid-connect"),

    fetch: z
      .custom<typeof globalThis.fetch>((v) => typeof v === "function")
      .optional()
      .default(() => globalThis.fetch),
  })
  .superRefine((data, ctx) => {
    // Handle secure cookie validation based on baseURL
    if (data.session && typeof data.session !== "boolean") {
      const cookieOptions = data.session.cookieOptions;
      if (isHttps.test(data.baseURL)) {
        if (cookieOptions.secure === false) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Setting your cookie to insecure when over https is not recommended, I hope you know what you're doing.",
            path: ["session", "cookieOptions", "secure"],
          });
        } else if (cookieOptions.secure === undefined) {
          // Default to true for HTTPS
          data.session.cookieOptions.secure = true;
        }
      } else if (cookieOptions.secure === true) {
        // Error for HTTP with secure cookie
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Cookies set with the `Secure` property won't be attached to http requests",
          path: ["session", "cookieOptions", "secure"],
        });
      } else if (cookieOptions.secure === undefined) {
        // Default to false for HTTP
        data.session.cookieOptions.secure = false;
      }
    }

    // Validate response_mode based on response_type
    if (data.authorizationParams) {
      const responseType = data.authorizationParams.response_type;
      const responseMode = data.authorizationParams.response_mode;

      if (responseType === "code") {
        if (responseMode && !["query", "form_post"].includes(responseMode)) {
          ctx.addIssue({
            code: z.ZodIssueCode.invalid_enum_value,
            options: ["query", "form_post"],
            received: responseMode,
            message:
              "For response_type 'code', response_mode must be 'query' or 'form_post'",
            path: ["authorizationParams", "response_mode"],
          });
        }
      } else if (responseMode && responseMode !== "form_post") {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_enum_value,
          options: ["form_post"],
          received: responseMode,
          message: "For this response_type, response_mode must be 'form_post'",
          path: ["authorizationParams", "response_mode"],
        });
      } else if (!responseMode) {
        // Set default for non-code response types
        data.authorizationParams.response_mode = "form_post";
      }

      // Warning about form_post with HTTP baseURL
      if (
        data.authorizationParams.response_mode === "form_post" &&
        !isHttps.test(data.baseURL)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Using 'form_post' for response_mode may cause issues for you logging in over http, see https://github.com/auth0/express-openid-connect/blob/master/FAQ.md",
          path: ["baseURL"],
        });
      }
    }

    // Validate clientSecret requirements
    if (
      data.clientAuthMethod &&
      data.clientAuthMethod.includes("client_secret") &&
      !data.clientSecret
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"clientSecret" is required for the "clientAuthMethod" "${data.clientAuthMethod}"`,
        path: ["clientSecret"],
      });
    }

    if (
      data.idTokenSigningAlg &&
      data.idTokenSigningAlg.startsWith("HS") &&
      !data.clientSecret
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '"clientSecret" is required for ID tokens with HMAC based algorithms',
        path: ["clientSecret"],
      });
    }

    // Validate clientAuthMethod
    if (
      data.authorizationParams?.response_type?.includes("code") &&
      data.clientAuthMethod === "none"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Public code flow clients are not supported.",
        path: ["clientAuthMethod"],
      });
    }

    if (data.pushedAuthorizationRequests && data.clientAuthMethod === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Public PAR clients are not supported.",
        path: ["clientAuthMethod"],
      });
    }

    // Set default clientAuthMethod
    if (data.clientAuthMethod === undefined) {
      if (
        data.authorizationParams?.response_type === "id_token" &&
        !data.pushedAuthorizationRequests
      ) {
        data.clientAuthMethod = "none";
      } else if (data.clientAssertionSigningKey) {
        data.clientAuthMethod = "private_key_jwt";
      } else {
        data.clientAuthMethod = "client_secret_basic";
      }
    }

    // Validate clientAssertionSigningKey
    if (
      data.clientAuthMethod === "private_key_jwt" &&
      !data.clientAssertionSigningKey
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '"clientAssertionSigningKey" is required for a "clientAuthMethod" of "private_key_jwt"',
        path: ["clientAssertionSigningKey"],
      });
    }
  });
