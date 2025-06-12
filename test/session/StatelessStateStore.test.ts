/* eslint-disable @typescript-eslint/ban-ts-comment */
import { BackchannelLogoutError, StateData } from "@auth0/auth0-server-js";
import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { MissingContextError } from "../../src/errors/index.js";
import { StatelessStateStore } from "../../src/session/StatelessStateStore.js";

// Mock dependencies
vi.mock("hono/cookie", () => ({
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

describe("StatelessStateStore", () => {
  let store: StatelessStateStore;
  let mockContext: Context;
  const identifier = "test-identifier";
  // @ts-ignore
  const stateData: StateData = {
    id: identifier,
    internal: {
      createdAt: 1000, // Fixed timestamp for testing
      sid: "aaa",
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock the encrypt and decrypt methods of AbstractSessionStore
    store = new StatelessStateStore({ secret: "test-secret" });
    // @ts-ignore
    store.encrypt = vi.fn().mockResolvedValue("encrypted-data");
    // @ts-ignore
    store.decrypt = vi.fn().mockResolvedValue(stateData);

    // Mock context with request headers
    mockContext = {
      req: {
        raw: {
          headers: {
            get: vi.fn().mockReturnValue(""),
          },
        },
      },
    } as unknown as Context;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("set", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.set(identifier, stateData)).rejects.toThrow(
        MissingContextError,
      );
    });

    it("should set cookie with encrypted data", async () => {
      // @ts-ignore
      vi.spyOn(store, "calculateMaxAge").mockReturnValue(3600);
      await store.set(identifier, stateData, false, mockContext);

      // Check if encrypt was called with correct parameters
      // @ts-ignore
      expect(store.encrypt as Mock).toHaveBeenCalledWith(
        identifier,
        stateData,
        Math.floor(Date.now() / 1000 + 3600),
      );

      // Check if setCookie was called with correct parameters
      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        `${identifier}.0`,
        "encrypted-data",
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: true,
          maxAge: 3600,
        },
      );
    });

    it("should handle cookie options from constructor", async () => {
      store = new StatelessStateStore({
        secret: "test-secret",
        cookie: {
          sameSite: "strict",
          secure: false,
        },
      });
      // @ts-ignore
      store.encrypt = vi.fn().mockResolvedValue("encrypted-data");
      // @ts-ignore
      vi.spyOn(store, "calculateMaxAge").mockReturnValue(3600);
      await store.set(identifier, stateData, false, mockContext);

      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        `${identifier}.0`,
        "encrypted-data",
        {
          httpOnly: true,
          sameSite: "strict",
          path: "/",
          secure: false,
          maxAge: 3600,
        },
      );
    });

    it("should split large data into multiple cookies", async () => {
      // Mock large encrypted data
      const largeData = "a".repeat(7000); // More than 2 chunks
      // @ts-ignore
      store.encrypt = vi.fn().mockResolvedValue(largeData);

      await store.set(identifier, stateData, false, mockContext);

      // Should create 3 cookies (7000 / 3072 = 2.28 => 3 chunks)
      expect(setCookie).toHaveBeenCalledTimes(3);
      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        `${identifier}.0`,
        "a".repeat(3072),
        expect.any(Object),
      );
      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        `${identifier}.1`,
        "a".repeat(3072),
        expect.any(Object),
      );
      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        `${identifier}.2`,
        "a".repeat(856), // 7000 - 3072 - 3072 = 856
        expect.any(Object),
      );
    });

    it("should delete excess cookies when data size decreases", async () => {
      // Mock cookie list with existing cookies
      // @ts-ignore
      mockContext.req.raw.headers.get.mockReturnValue(
        `${identifier}.0=value; ${identifier}.1=value; ${identifier}.2=value`,
      );

      // Mock short encrypted data (only needs one cookie)
      // @ts-ignore
      store.encrypt = vi.fn().mockResolvedValue("short-data");
      // @ts-ignore
      vi.spyOn(store, "calculateMaxAge").mockReturnValue(3600);

      await store.set(identifier, stateData, false, mockContext);

      // Should set the first cookie and delete the others
      expect(setCookie).toHaveBeenCalledTimes(1);
      expect(setCookie).toHaveBeenCalledWith(
        mockContext,
        `${identifier}.0`,
        "short-data",
        expect.any(Object),
      );

      // Should delete extra cookies
      expect(deleteCookie).toHaveBeenCalledTimes(2);
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, `${identifier}.1`);
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, `${identifier}.2`);
    });
  });

  describe("get", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.get(identifier)).rejects.toThrow(MissingContextError);
    });

    it("should return undefined when no cookies are found", async () => {
      // Mock cookie list with no matching cookies
      // @ts-ignore
      mockContext.req.raw.headers.get.mockReturnValue("other-cookie=value");

      const result = await store.get(identifier, mockContext);
      expect(result).toBeUndefined();
    });

    it("should retrieve and combine cookie chunks", async () => {
      // Mock cookie list with chunks
      // @ts-ignore
      mockContext.req.raw.headers.get.mockReturnValue(
        `${identifier}.0=value; ${identifier}.1=value`,
      );

      // Mock cookie values
      (getCookie as Mock).mockImplementation((_, key) => {
        if (key === `${identifier}.0`) return "chunk1";
        if (key === `${identifier}.1`) return "chunk2";
        return null;
      });

      const result = await store.get(identifier, mockContext);

      // Check if decrypt was called with combined chunks
      // @ts-ignore
      expect(store.decrypt as Mock).toHaveBeenCalledWith(
        identifier,
        "chunk1chunk2",
      );

      // Should return the decrypted data
      expect(result).toEqual(stateData);
    });

    it("should sort chunks by index", async () => {
      // Mock cookie list with chunks in random order
      // @ts-ignore
      mockContext.req.raw.headers.get.mockReturnValue(
        `${identifier}.1=value; ${identifier}.0=value; ${identifier}.2=value`,
      );

      // Mock cookie values
      (getCookie as Mock).mockImplementation((_, key) => {
        if (key === `${identifier}.0`) return "first";
        if (key === `${identifier}.1`) return "second";
        if (key === `${identifier}.2`) return "third";
        return null;
      });

      const result = await store.get(identifier, mockContext);

      // Check if decrypt was called with combined chunks in correct order
      // @ts-ignore
      expect(store.decrypt as Mock).toHaveBeenCalledWith(
        identifier,
        "firstsecondthird",
      );

      // Should return the decrypted data
      expect(result).toEqual(stateData);
    });
  });

  describe("delete", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.delete(identifier)).rejects.toThrow(
        MissingContextError,
      );
    });

    it("should delete all cookies with matching identifier", async () => {
      // Mock cookie list with chunks
      // @ts-ignore
      mockContext.req.raw.headers.get.mockReturnValue(
        `${identifier}.0=value; ${identifier}.1=value; other-cookie=value`,
      );

      await store.delete(identifier, mockContext);

      // Should delete all cookies with matching identifier
      expect(deleteCookie).toHaveBeenCalledTimes(2);
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, `${identifier}.0`);
      expect(deleteCookie).toHaveBeenCalledWith(mockContext, `${identifier}.1`);
    });
  });

  describe("deleteByLogoutToken", () => {
    it("should throw BackchannelLogoutError", async () => {
      await expect(store.deleteByLogoutToken()).rejects.toThrow(
        BackchannelLogoutError,
      );
    });
  });
});
