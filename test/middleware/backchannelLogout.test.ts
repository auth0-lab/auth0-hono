/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { getClient } from "../../src/config/index.js";
import { backchannelLogout } from "../../src/middleware/backchannelLogout.js";

// Mock dependencies
vi.mock("../../src/config/index.js", () => ({
  getClient: vi.fn(),
}));

describe("backchannelLogout middleware", () => {
  let mockContext: Context;
  let mockClient: any;
  const nextFn = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    // Create a mock client
    mockClient = {
      handleBackchannelLogout: vi.fn().mockResolvedValue(undefined),
    };

    // Create a mock Hono context
    mockContext = {
      req: {
        header: vi.fn().mockImplementation((name) => {
          if (name === "content-type") {
            return "application/x-www-form-urlencoded";
          }
          return null;
        }),
        parseBody: vi.fn().mockResolvedValue({
          logout_token: "mock-logout-token",
        }),
      },
    } as unknown as Context;

    // Setup the getClient mock
    (getClient as Mock).mockReturnValue({
      client: mockClient,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("when a valid logout request is received", () => {
    let result: Response;

    beforeEach(async () => {
      result = (await backchannelLogout()(mockContext, nextFn)) as Response;
    });

    it("should check the content type", () => {
      expect(mockContext.req.header).toHaveBeenCalledWith("content-type");
    });

    it("should parse the request body", () => {
      expect(mockContext.req.parseBody).toHaveBeenCalled();
    });

    it("should get the client", () => {
      expect(getClient).toHaveBeenCalledWith(mockContext);
    });

    it("should call client.handleBackchannelLogout with the logout token", () => {
      expect(mockClient.handleBackchannelLogout).toHaveBeenCalledWith(
        "mock-logout-token",
        mockContext,
      );
    });

    it("should return a 204 No Content response", () => {
      expect(result.status).toBe(204);
    });
  });

  describe("when the content type is invalid", () => {
    beforeEach(() => {
      // Override the header mock to return an invalid content type
      mockContext.req.header = vi.fn().mockReturnValue("application/json");
    });

    it("should throw a 400 error with appropriate message", async () => {
      await expect(backchannelLogout()(mockContext, nextFn)).rejects.toThrow(
        new HTTPException(400, {
          message:
            "Invalid content type. Expected 'application/x-www-form-urlencoded'.",
        }),
      );
    });
  });

  describe("when the content type is missing", () => {
    beforeEach(() => {
      // Override the header mock to return null (missing content type)
      mockContext.req.header = vi.fn().mockReturnValue(null);
    });

    it("should throw a 400 error with appropriate message", async () => {
      await expect(backchannelLogout()(mockContext, nextFn)).rejects.toThrow(
        new HTTPException(400, {
          message:
            "Invalid content type. Expected 'application/x-www-form-urlencoded'.",
        }),
      );
    });
  });

  describe("when the logout token is missing", () => {
    beforeEach(() => {
      // Override the parseBody mock to return an empty object
      mockContext.req.parseBody = vi.fn().mockResolvedValue({});
    });

    it("should throw a 400 error with appropriate message", async () => {
      await expect(backchannelLogout()(mockContext, nextFn)).rejects.toThrow(
        new HTTPException(400, {
          message: "Missing `logout_token` in the request body.",
        }),
      );
    });
  });

  describe("when the logout token is not a string", () => {
    beforeEach(() => {
      // Override the parseBody mock to return a non-string logout token
      mockContext.req.parseBody = vi.fn().mockResolvedValue({
        logout_token: 123,
      });
    });

    it("should throw a 400 error with appropriate message", async () => {
      await expect(backchannelLogout()(mockContext, nextFn)).rejects.toThrow(
        new HTTPException(400, {
          message: "Missing `logout_token` in the request body.",
        }),
      );
    });
  });

  describe("when client.handleBackchannelLogout throws an error", () => {
    const errorMessage = "Invalid logout token";

    beforeEach(() => {
      // Override the handleBackchannelLogout mock to throw an error
      mockClient.handleBackchannelLogout = vi
        .fn()
        .mockRejectedValue(new Error(errorMessage));
    });

    it("should throw a 400 error with the error message", async () => {
      await expect(backchannelLogout()(mockContext, nextFn)).rejects.toThrow(
        new HTTPException(400, {
          message: errorMessage,
        }),
      );
    });
  });
});
