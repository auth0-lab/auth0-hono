/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { LogoutTokenClaims, StateData } from "@auth0/auth0-server-js";
import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissingContextError } from "../../src/errors/index.js";
import { StatefulStateStore } from "../../src/session/StatefulStateStore.js";
import { SessionStore } from "../../src/types/session.js";

// Mock dependencies
vi.mock("hono/cookie", () => ({
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock("crypto", () => ({
  getRandomValues: vi.fn((arr) => {
    // Fill array with predictable values for testing
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i % 256;
    }
    return arr;
  }),
}));

describe("StatefulStateStore", () => {
  let store: StatefulStateStore;
  let mockContext: Context;
  let mockSessionStore: SessionStore;
  const identifier = "test-identifier";
  // @ts-ignore - this is just a test mock
  const stateData = {
    internal: {
      createdAt: 1600000000,
    },
    data: { test: "data" },
  } as StateData;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock the SessionStore
    mockSessionStore = {
      get: vi.fn().mockResolvedValue(stateData),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByLogoutToken: vi.fn().mockResolvedValue(undefined),
    };

    // Create StatefulStateStore instance with mocked encrypt/decrypt
    store = new StatefulStateStore({
      secret: "test-secret",
      store: mockSessionStore,
    });

    // Mock private methods
    vi.spyOn(store, "encrypt" as any).mockResolvedValue("encrypted-data");
    vi.spyOn(store, "decrypt" as any).mockResolvedValue({
      id: expect.any(String),
    });
    vi.spyOn(store, "calculateMaxAge" as any).mockReturnValue(86400); // 1 day in seconds

    // Mock the getSessionId method
    vi.spyOn(store, "getSessionId" as any).mockImplementation(
      //@ts-ignore
      async (id: string, ctx: Context) => {
        const cookieValue = getCookie(ctx, id);
        return cookieValue ? expect.any(String) : undefined;
      },
    );

    // Mock context
    mockContext = {} as Context;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with the provided store and options", () => {
      // We'll test the constructor through the behavior of the set method
      const customStore = new StatefulStateStore({
        secret: "test-secret",
        store: mockSessionStore,
        cookie: {
          sameSite: "strict",
          secure: false,
        },
      });

      expect(customStore).toBeInstanceOf(StatefulStateStore);
    });
  });

  describe("set", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.set(identifier, stateData)).rejects.toThrow(
        MissingContextError,
      );
    });

    it("should set cookie with encrypted session ID", async () => {
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(1000 * 1000); // Mock Date.now()

      await store.set(identifier, stateData, false, mockContext);

      // Check if encrypt was called with correct parameters
      // @ts-ignore
      expect(store.encrypt).toHaveBeenCalledWith(
        identifier,
        { id: expect.any(String) }, // session ID object
        1000 + 86400, // current time + maxAge
      );

      // Check if setCookie was called with correct parameters
      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        identifier,
        "encrypted-data",
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: true,
          maxAge: 86400,
        },
      );

      // Check if session store's set method was called
      expect(mockSessionStore.set).toHaveBeenCalledWith(
        expect.any(String), // session ID
        stateData,
      );

      dateSpy.mockRestore();
    });

    it("should generate new session ID when none exists", async () => {
      // @ts-ignore - Mock getSessionId to return undefined
      vi.spyOn(store, "getSessionId").mockResolvedValue(undefined);

      await store.set(identifier, stateData, false, mockContext);

      // Should call store.set with the generated ID
      expect(mockSessionStore.set).toHaveBeenCalledWith(
        expect.any(String),
        stateData,
      );
    });

    it("should remove existing session and generate new ID when removeIfExists is true", async () => {
      // @ts-ignore - Mock getSessionId to return an existing ID
      vi.spyOn(store, "getSessionId").mockResolvedValue("existing-id");

      await store.set(identifier, stateData, true, mockContext);

      // Should delete the existing session
      expect(mockSessionStore.delete).toHaveBeenCalledWith("existing-id");

      // Should set with new generated ID
      expect(mockSessionStore.set).toHaveBeenCalledWith(
        expect.any(String),
        stateData,
      );
    });

    it("should use custom cookie options when provided", async () => {
      // Create a store with custom cookie options
      const customStore = new StatefulStateStore({
        secret: "test-secret",
        store: mockSessionStore,
        cookie: {
          sameSite: "strict",
          secure: false,
        },
      });

      // @ts-ignore - Mock encrypt
      customStore.encrypt = vi.fn().mockResolvedValue("encrypted-data");
      // @ts-ignore
      customStore.calculateMaxAge = vi.fn().mockReturnValue(86400);

      await customStore.set(identifier, stateData, false, mockContext);

      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        identifier,
        "encrypted-data",
        {
          httpOnly: true,
          maxAge: 86400,
          sameSite: "strict",
          path: "/",
          secure: false,
        },
      );
    });
  });

  describe("get", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.get(identifier)).rejects.toThrow(MissingContextError);
    });

    it("should return undefined when no session cookie is found", async () => {
      // Mock getCookie to return undefined
      vi.mocked(getCookie).mockReturnValue(undefined);

      const result = await store.get(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(result).toBeUndefined();
    });

    it("should return data from session store when session ID is found", async () => {
      // Mock getCookie to return a cookie value
      vi.mocked(getCookie).mockReturnValue("encrypted-cookie");
      (mockSessionStore.get as any).mockResolvedValue(stateData);

      const result = await store.get(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);

      expect(mockSessionStore.get).toHaveBeenCalledWith(expect.any(String));
      expect(result).toEqual(stateData);
    });

    it("should delete cookie when session ID exists but no data is found", async () => {
      // Mock getCookie to return a cookie value
      vi.mocked(getCookie).mockReturnValue("encrypted-cookie");
      // Mock store.get to return undefined (no session data)
      mockSessionStore.get = vi.fn().mockResolvedValue(undefined);

      const result = await store.get(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(mockSessionStore.get).toHaveBeenCalledWith(expect.any(String));
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.delete(identifier)).rejects.toThrow(
        MissingContextError,
      );
    });

    it("should delete session data and cookie when session ID is found", async () => {
      // Mock getCookie to return a cookie value
      vi.mocked(getCookie).mockReturnValue("encrypted-cookie");

      await store.delete(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(mockSessionStore.delete).toHaveBeenCalledWith(expect.any(String));
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, identifier);
    });

    it("should only delete cookie when no session ID is found", async () => {
      // Mock getCookie to return undefined
      vi.mocked(getCookie).mockReturnValue(undefined);

      await store.delete(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(mockSessionStore.delete).not.toHaveBeenCalled();
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, identifier);
    });
  });

  describe("getSessionId", () => {
    it("should return undefined when no cookie is found", async () => {
      // Mock getCookie to return undefined
      vi.mocked(getCookie).mockReturnValue(undefined);

      // @ts-ignore - private method
      const result = await store.getSessionId(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(result).toBeUndefined();
    });
  });

  describe("deleteByLogoutToken", () => {
    it("should delegate to the session store", async () => {
      const claims: LogoutTokenClaims = {
        sub: "test-subject",
        sid: "test-sid",
        // iat: 1600000000,
        // aud: "test-audience",
        // iss: "test-issuer",
        // events: {},
      };

      await store.deleteByLogoutToken(claims, mockContext);

      expect(mockSessionStore.deleteByLogoutToken).toHaveBeenCalledWith(
        claims,
        mockContext,
      );
    });
  });
});
