/* eslint-disable @typescript-eslint/no-explicit-any */
import * as oidc from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Configuration } from "../src/config/Configuration";
import { initializeOidcClient } from "../src/lib/client";

// Mock module with manual mock implementation
vi.mock("openid-client", async () => {
  const customFetch = Symbol("customFetch");
  return {
    discovery: vi.fn(),
    ClientSecretBasic: vi.fn(),
    ClientSecretPost: vi.fn(),
    ClientSecretJwt: vi.fn(),
    PrivateKeyJwt: vi.fn(),
    None: {},
    customFetch,
  };
});

// Mock QuickLRU
vi.mock("quick-lru", () => {
  return {
    default: class MockLRU {
      cache: Map<any, any>;
      constructor() {
        this.cache = new Map();
      }
      has(key: string) {
        return this.cache.has(key);
      }
      get(key: string) {
        return this.cache.get(key);
      }
      set(key: string, value: any) {
        this.cache.set(key, value);
        return this;
      }
    },
  };
});

describe("OIDC Client Initialization", () => {
  let mockConfig: Configuration;
  let mockOidcClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create base mock configuration
    mockConfig = {
      domain: "auth.example.com",
      baseURL: "https://app.example.com",
      clientID: "test-client-id",
      clientSecret: "test-client-secret",
      authRequired: true,
      clientAuthMethod: "client_secret_basic",
      authorizationParams: {
        response_type: "code",
        scope: "openid profile email",
      },
      debug: () => {},
      idpLogout: false,
      clockTolerance: 60,
      enableTelemetry: true,
      httpTimeout: 5000,
      fetch: globalThis.fetch,
      httpUserAgent: "hono-openid-connect",
      discoveryCacheMaxAge: 10 * 60 * 1000,
      idTokenSigningAlg: "RS256",
      excludedClaims: ["aud", "iss", "iat", "exp"],
      errorOnRequiredAuth: false,
      attemptSilentLogin: false,
      customRoutes: [],
      pushedAuthorizationRequests: false,
      routes: {
        login: "/login",
        logout: "/logout",
        callback: "/callback",
      },
      session: false,
    };

    // Create mock OIDC client
    mockOidcClient = {
      [oidc.customFetch]: null,
      timeout: null,
      serverMetadata: vi.fn().mockReturnValue({
        // Default metadata without PAR endpoint
        authorization_endpoint: "https://auth.example.com/authorize",
        token_endpoint: "https://auth.example.com/token",
      }),
    };

    // Mock discovery to return client
    (oidc.discovery as any).mockResolvedValue(mockOidcClient);
  });

  it("should initialize client successfully with default configuration", async () => {
    const client = await initializeOidcClient(mockConfig);

    expect(oidc.discovery).toHaveBeenCalled();
    expect(client).toBeDefined();
    expect(client[oidc.customFetch]).toBe(mockConfig.fetch);
  });

  it("should throw error when pushedAuthorizationRequests is true but endpoint is not configured", async () => {
    // Mock the discovery function to return a client without PAR endpoint
    (oidc.discovery as any).mockImplementationOnce(() => {
      // Return a promise that resolves to a client without PAR endpoint
      return Promise.resolve({
        [oidc.customFetch]: null,
        timeout: null,
        serverMetadata: () => ({
          authorization_endpoint: "https://auth.example.com/authorize",
          token_endpoint: "https://auth.example.com/token",
          // No pushed_authorization_request_endpoint
        }),
      });
    });

    // Enable pushed authorization requests
    mockConfig = {
      ...mockConfig,
      clientID: "test-client-id-1234",
      pushedAuthorizationRequests: true,
    };

    // Wrap in a try-catch since we're expecting an error
    let error: Error | undefined;
    try {
      await initializeOidcClient(mockConfig);
    } catch (e) {
      error = e as Error;
    }
    // Verify error was thrown with expected message
    expect(error).toBeDefined();
    expect(error!.message).toContain("Could not initialize OIDC client");
    expect(error!.cause || error).toMatchObject(
      expect.objectContaining({
        message: expect.stringContaining(
          "pushed_authorization_request_endpoint must be configured",
        ),
      }),
    );
  });

  it("should succeed when pushedAuthorizationRequests is true and endpoint is configured", async () => {
    // Mock implementation for this specific test case
    (oidc.discovery as any).mockImplementationOnce(async () => {
      return {
        [oidc.customFetch]: null,
        timeout: null,
        serverMetadata: () => ({
          authorization_endpoint: "https://auth.example.com/authorize",
          token_endpoint: "https://auth.example.com/token",
          pushed_authorization_request_endpoint: "https://auth.example.com/par", // PAR endpoint present
        }),
      };
    });

    // Enable pushed authorization requests
    mockConfig.pushedAuthorizationRequests = true;

    // Should not throw an error
    const client = await initializeOidcClient(mockConfig);
    expect(client).toBeDefined();
  });

  it("should succeed when pushedAuthorizationRequests is false, regardless of endpoint", async () => {
    // Mock implementation with no PAR endpoint
    (oidc.discovery as any).mockImplementationOnce(async () => {
      return {
        [oidc.customFetch]: null,
        timeout: null,
        serverMetadata: () => ({
          authorization_endpoint: "https://auth.example.com/authorize",
          token_endpoint: "https://auth.example.com/token",
          // No pushed_authorization_request_endpoint
        }),
      };
    });

    // Disable pushed authorization requests
    mockConfig.pushedAuthorizationRequests = false;

    // Should not throw an error
    const client = await initializeOidcClient(mockConfig);
    expect(client).toBeDefined();
  });
});
