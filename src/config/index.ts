import { OIDCEnv } from "@/lib/honoEnv.js";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { Configuration, InitConfiguration } from "./Configuration.js";
import { ConfigurationSchema } from "./Schema.js";

const parsedConfig = new Map<InitConfiguration, Configuration>();

export const parseConfiguration = (
  config: InitConfiguration,
): Configuration => {
  if (parsedConfig.has(config)) {
    return parsedConfig.get(config)!;
  }
  const result = ConfigurationSchema.parse(config) as Configuration;
  parsedConfig.set(config, result);
  return result;
};
export {
  assignFromEnv,
  type ConditionalInitConfig,
} from "@/config/envConfig.js";

export const getClient = (c: Context<OIDCEnv>) => {
  if (!c.var.auth0Client || !c.var.auth0Configuration) {
    throw new HTTPException(500, {
      message:
        "The auth0 middleware is not properly configured. Install `auth` first.",
    });
  }
  return {
    client: c.var.auth0Client,
    configuration: c.var.auth0Configuration,
  };
};
