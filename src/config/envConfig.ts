import { InitConfiguration } from "@/config/Configuration.js";
import { MakeOptional } from "@/types/util.js";

export type MinimalConfigByEnv = {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET?: string;
  AUTH0_AUDIENCE?: string;
  BASE_URL: string;
  AUTH0_SESSION_ENCRYPTION_KEY?: string;
};

type PartialConfig = MakeOptional<
  InitConfiguration,
  "clientID" | "clientSecret" | "domain" | "baseURL" | "session"
>;

export type ConditionalInitConfig = NodeJS.ProcessEnv extends MinimalConfigByEnv
  ? PartialConfig
  : InitConfiguration;

export const envHasConfig = (
  config: MinimalConfigByEnv | unknown,
): config is MinimalConfigByEnv => {
  return (
    typeof config === "object" &&
    config !== null &&
    "AUTH0_DOMAIN" in config &&
    "AUTH0_CLIENT_ID" in config &&
    "BASE_URL" in config &&
    typeof config.AUTH0_DOMAIN === "string" &&
    typeof config.AUTH0_CLIENT_ID === "string" &&
    typeof config.BASE_URL === "string"
  );
};

export const assignFromEnv = (
  config: ConditionalInitConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: Record<string, any>,
): InitConfiguration => {
  const configWithoutEnv = config ?? ({} as ConditionalInitConfig);

  if (!envHasConfig(env)) {
    return configWithoutEnv as InitConfiguration;
  }

  const {
    AUTH0_DOMAIN,
    AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET,
    BASE_URL,
    AUTH0_AUDIENCE,
  } = env;
  //todo: fix
  return {
    ...configWithoutEnv,
    domain: configWithoutEnv.domain ?? AUTH0_DOMAIN,
    clientID: configWithoutEnv.clientID ?? AUTH0_CLIENT_ID,
    clientSecret: configWithoutEnv.clientSecret ?? AUTH0_CLIENT_SECRET,
    baseURL: configWithoutEnv.baseURL ?? BASE_URL,
    authorizationParams: AUTH0_AUDIENCE
      ? { audience: AUTH0_AUDIENCE }
      : undefined,
    session:
      configWithoutEnv.session === false
        ? false
        : {
            ...(configWithoutEnv.session || {}),
            secret:
              configWithoutEnv.session?.secret ??
              process.env.AUTH0_SESSION_ENCRYPTION_KEY,
          },
  };
};
