import { Configuration } from "@/config/Configuration.js";
import { ServerClient } from "@auth0/auth0-server-js";
import { Context } from "hono";

// Extend the Hono context to include OIDC context
export interface OIDCVariables {
  /**
   * The middleware configuration parsed and with its default values.
   */
  auth0Configuration?: Configuration;

  /**
   * The OIDC client configuration for the openid-client
   */
  auth0Client?: ServerClient<Context>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OIDCEnv<TBindings = any> {
  Bindings: TBindings;
  Variables: OIDCVariables;
}
