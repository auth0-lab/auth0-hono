import { getClient } from "@/config/index.js";
import { OIDCEnv } from "@/lib/honoEnv.js";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

/**
 * Handle logout requests
 */
export const backchannelLogout = () => {
  return createMiddleware<OIDCEnv>(async function (c): Promise<Response> {
    const contentType = c.req.header("content-type");
    if (
      !contentType ||
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      throw new HTTPException(400, {
        message:
          "Invalid content type. Expected 'application/x-www-form-urlencoded'.",
      });
    }

    const { logout_token: logoutToken } = await c.req.parseBody();

    if (!logoutToken || typeof logoutToken !== "string") {
      throw new HTTPException(400, {
        message: "Missing `logout_token` in the request body.",
      });
    }
    const { client } = getClient(c);

    try {
      await client.handleBackchannelLogout(logoutToken, c);
      return new Response(null, {
        status: 204,
      });
    } catch (e) {
      throw new HTTPException(400, {
        message: (e as Error).message,
      });
    }
  });
};
