/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { parseConfiguration } from "../src/config";
import { InitConfiguration } from "../src/config/Configuration";
import { assignFromEnv } from "../src/config/envConfig";

describe("Configuration Parser", () => {
  it("should parse a valid configuration", () => {
    const validConfig: InitConfiguration = {
      domain: "auth.example.com",
      baseURL: "https://app.example.com",
      clientID: "test-client-id",
      clientSecret: "test",
      session: {
        secret: "test encryption key fdsgfds gfds ",
      },
    };

    const parsedConfig = parseConfiguration(validConfig);

    expect(parsedConfig).toHaveProperty("domain", "auth.example.com");
    expect(parsedConfig).toHaveProperty("baseURL", "https://app.example.com");
    expect(parsedConfig).toHaveProperty("clientID", "test-client-id");
    expect(parsedConfig).toHaveProperty("authRequired", true); // default value
    expect(parsedConfig).toHaveProperty("fetch", globalThis.fetch); // default value
    expect(parsedConfig).toMatchSnapshot();
  });

  it("should throw an error for invalid configuration", () => {
    const invalidConfig = {
      // Missing required domain
      baseURL: "https://app.example.com",
      clientID: "test-client-id",
    };

    expect(() => parseConfiguration(invalidConfig as any)).toThrow();
  });

  it("should apply default values to configuration", () => {
    const minimalConfig: InitConfiguration = {
      domain: "auth.example.com",
      baseURL: "https://app.example.com",
      clientID: "test-client-id",
      clientSecret: "test-client-secret",
      session: {
        secret: "test encryption key fdsgfds gfds ",
      },
    };

    const parsedConfig = parseConfiguration(minimalConfig);

    expect(parsedConfig).toHaveProperty("authRequired", true);
    expect(parsedConfig).toHaveProperty("clockTolerance", 60);
    expect(parsedConfig).toHaveProperty("routes");

    expect(parsedConfig.routes).toEqual({
      login: "/auth/login",
      logout: "/auth/logout",
      callback: "/auth/callback",
      backchannelLogout: "/auth/backchannel-logout",
    });
  });

  it("should cache parsed configurations", () => {
    const config: InitConfiguration = {
      domain: "auth.example.com",
      baseURL: "https://app.example.com",
      clientID: "test-client-id",
      clientSecret: "test",
      session: {
        secret: "test encryption key fdsgfds gfds ",
      },
    };

    const firstParsed = parseConfiguration(config);
    const secondParsed = parseConfiguration(config);

    expect(firstParsed).toBe(secondParsed); // Should be the same object instance (cached)
  });

  it("should not allow custom routes to be set to relative paths", () => {
    const config: InitConfiguration = {
      domain: "auth.example.com",
      baseURL: "https://app.example.com",
      clientID: "test-client-id",
      routes: {
        login: "login",
      },
      session: {
        secret: "test encryption key fdsgfds gfds ",
      },
    };

    expect(() => parseConfiguration(config)).toThrow();
  });
});

describe("Environment Configuration", () => {
  describe("assignFromEnv", () => {
    const validEnv = {
      AUTH0_DOMAIN: "test.auth0.com",
      AUTH0_CLIENT_ID: "test-client-id",
      BASE_URL: "https://example.com",
      AUTH0_CLIENT_SECRET: "test-secret",
      AUTH0_AUDIENCE: "https://api.example.com",
    };

    it("should assign audience from env to authorizationParams when audience only exists in env and not config", () => {
      const config = {};
      const env = validEnv;

      const result = assignFromEnv(config, env);

      expect(result.authorizationParams).toEqual({
        audience: "https://api.example.com",
      });
    });

    it("should prioritize config authorizationParams.audience over env audience when both exist", () => {
      const config = {
        authorizationParams: {
          audience: "https://config-audience.com",
          scope: "openid profile",
        },
      };
      const env = validEnv;

      const result = assignFromEnv(config, env);

      expect(result.authorizationParams).toEqual({
        audience: "https://config-audience.com",
        scope: "openid profile",
      });
    });

    it("should propagate all other authorizationParams from config and merge with env audience if there is no config audience", () => {
      const config = {
        authorizationParams: {
          scope: "openid profile email",
          prompt: "login",
          max_age: 3600,
          ui_locales: "en-US",
        },
      };
      const env = validEnv;

      const result = assignFromEnv(config, env);

      expect(result.authorizationParams).toEqual({
        scope: "openid profile email",
        prompt: "login",
        max_age: 3600,
        ui_locales: "en-US",
        audience: "https://api.example.com",
      });
    });

    it("should assign env audience when config has empty authorizationParams object", () => {
      const config = {
        authorizationParams: {},
      };
      const env = validEnv;

      const result = assignFromEnv(config, env);

      expect(result.authorizationParams).toEqual({
        audience: "https://api.example.com",
      });
    });

    it("should assign env audience when config has no authorizationParams defined", () => {
      const config = {};
      const env = validEnv;

      const result = assignFromEnv(config, env);

      expect(result.authorizationParams).toEqual({
        audience: "https://api.example.com",
      });
    });

    it("should not set audience when audience is absent from both env and config", () => {
      const config = {
        authorizationParams: {
          scope: "openid profile",
        },
      };
      const envWithoutAudience = {
        AUTH0_DOMAIN: "test.auth0.com",
        AUTH0_CLIENT_ID: "test-client-id",
        BASE_URL: "https://example.com",
      };

      const result = assignFromEnv(config, envWithoutAudience);

      expect(result.authorizationParams).toEqual({
        scope: "openid profile",
      });
    });

    it("should handle undefined config gracefully and use env values", () => {
      const config = undefined;
      const env = validEnv;

      const result = assignFromEnv(config, env);

      expect(result.authorizationParams).toEqual({
        audience: "https://api.example.com",
      });
      expect(result.domain).toBe("test.auth0.com");
      expect(result.clientID).toBe("test-client-id");
      expect(result.baseURL).toBe("https://example.com");
    });

    it("should return config as-is when env doesn't have required fields", () => {
      const config = {
        domain: "config.auth0.com",
        clientID: "config-client-id",
        authorizationParams: {
          scope: "openid profile",
        },
      };
      const invalidEnv = {
        // Missing required AUTH0_DOMAIN, AUTH0_CLIENT_ID, BASE_URL
        AUTH0_AUDIENCE: "https://api.example.com",
      };

      const result = assignFromEnv(config, invalidEnv);

      expect(result).toEqual(config);
    });
  });
});
