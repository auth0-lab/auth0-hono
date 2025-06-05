/* eslint-disable @typescript-eslint/ban-ts-comment */
import { TransactionData } from "@auth0/auth0-server-js";
import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { MissingContextError } from "../../src/errors/index.js";
import { CookieTransactionStore } from "../../src/session/CookieTransactionStore";

// Mock dependencies
vi.mock("hono/cookie", () => ({
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

describe("CookieTransactionStore", () => {
  let store: CookieTransactionStore;
  let mockContext: Context;
  const identifier = "test-identifier";
  // @ts-ignore
  const transactionData = { state: "test-state" } as TransactionData;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock the encrypt and decrypt methods of AbstractTransactionStore
    store = new CookieTransactionStore({ secret: "very" });
    // @ts-ignore
    store.encrypt = vi.fn().mockResolvedValue("encrypted-data");
    // @ts-ignore
    store.decrypt = vi.fn().mockResolvedValue(transactionData);

    // Mock context
    mockContext = {} as Context;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("set", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.set(identifier, transactionData)).rejects.toThrow(
        MissingContextError,
      );
    });

    it("should set cookie with encrypted data", async () => {
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(1000 * 1000); // Mock Date.now()

      await store.set(identifier, transactionData, false, mockContext);

      // Check if encrypt was called with correct parameters
      // @ts-ignore
      expect(store.encrypt as Mock).toHaveBeenCalledWith(
        identifier,
        transactionData,
        Math.floor(1000 + 60 * 60), // current time + maxAge
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
          maxAge: 60 * 60,
        },
      );

      dateSpy.mockRestore();
    });
  });

  describe("get", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.get(identifier)).rejects.toThrow(MissingContextError);
    });

    it("should return undefined when cookie is not found", async () => {
      vi.mocked(getCookie).mockReturnValue(undefined);

      const result = await store.get(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(result).toBeUndefined();
    });

    it("should return decrypted data when cookie is found", async () => {
      vi.mocked(getCookie).mockReturnValue("encrypted-cookie-value");
      // @ts-ignore
      const decryptSpy = vi.spyOn(store, "decrypt");

      const result = await store.get(identifier, mockContext);

      expect(getCookie).toHaveBeenCalledWith(mockContext, identifier);
      expect(decryptSpy).toHaveBeenCalledWith(
        identifier,
        "encrypted-cookie-value",
      );
      expect(result).toEqual(transactionData);
    });
  });

  describe("delete", () => {
    it("should throw MissingContextError when context is not provided", async () => {
      await expect(store.delete(identifier)).rejects.toThrow(
        MissingContextError,
      );
    });

    it("should delete cookie", async () => {
      await store.delete(identifier, mockContext);

      expect(deleteCookie).toHaveBeenCalledWith(mockContext, identifier);
    });
  });
});
