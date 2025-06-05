import { getClient } from "@/config/index.js";
import { createRouteUrl, toSafeRedirect } from "@/utils/util.js";
import { Next } from "hono";
import { createMiddleware } from "hono/factory";
import { OIDCEnv } from "../lib/honoEnv.js";
import { resumeSilentLogin } from "./silentLogin.js";

type CallbackParams = {
  /**
   * Optionally override the url to redirect after succesful
   * authentication.
   *
   * Or disable it completely by setting it to false
   * to continue to the next middleware.
   */
  redirectAfterLogin?: string | false;
};

/**
 * Handle callback from the OIDC provider
 */
export const callback = (params: CallbackParams = {}) => {
  return createMiddleware<OIDCEnv>(async function callback(
    c,
    next: Next,
  ): Promise<Response | void> {
    try {
      const { client, configuration } = getClient(c);
      const { baseURL } = configuration;

      const { appState } = await client.completeInteractiveLogin<
        { returnTo: string } | undefined
      >(createRouteUrl(c.req.url, baseURL), c);
      await resumeSilentLogin()(c, next);

      if (params.redirectAfterLogin === false) {
        return next();
      }

      const finalURL =
        (params.redirectAfterLogin
          ? toSafeRedirect(params.redirectAfterLogin, baseURL)
          : undefined) ??
        appState?.returnTo ??
        baseURL;

      return c.redirect(finalURL);
    } catch (err) {
      await resumeSilentLogin()(c, next);
      throw err;
    }
  });
};
