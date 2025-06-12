import { getClient } from "@/config/index.js";
import { OIDCEnv } from "@/lib/honoEnv.js";
import { toSafeRedirect } from "@/utils/util.js";
import { createMiddleware } from "hono/factory";
import { resumeSilentLogin } from "./silentLogin.js";

type LogoutParams = {
  redirectAfterLogout?: string;
};

/**
 * Handle logout requests
 */
export const logout = (params: LogoutParams = {}) => {
  return createMiddleware<OIDCEnv>(async function (c, next): Promise<Response> {
    const { client, configuration } = getClient(c);
    const session = await client.getSession(c);

    const returnTo =
      (params.redirectAfterLogout
        ? toSafeRedirect(params.redirectAfterLogout, configuration.baseURL)
        : undefined) ?? configuration.baseURL;

    if (!session) {
      return c.redirect(returnTo);
    }

    const logoutUrl = await client.logout({ returnTo }, c);

    await resumeSilentLogin()(c, next);

    if (!configuration.idpLogout) {
      return c.redirect(returnTo);
    }

    return c.redirect(logoutUrl);
  });
};
