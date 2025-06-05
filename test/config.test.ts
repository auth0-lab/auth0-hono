/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { parseConfiguration } from "../src/config";
import { InitConfiguration } from "../src/config/Configuration";

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
