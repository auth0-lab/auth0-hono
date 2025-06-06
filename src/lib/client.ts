import { Configuration } from "@/config/Configuration.js";
import { CookieTransactionStore } from "@/session/CookieTransactionStore.js";
import { HonoCookieHandler } from "@/session/HonoCookieHandler.js";
import { StatefulStateStore } from "@/session/StatefulStateStore.js";
import { StatelessStateStore } from "@/session/StatelessStateStore.js";
import { createRouteUrl } from "@/utils/util.js";
import { ServerClient } from "@auth0/auth0-server-js";
import { Context } from "vm";

/**
 * Initialize the OpenID Connect client
 */
export function initializeOidcClient(config: Configuration) {
  return new ServerClient<Context>({
    domain: config.domain,
    clientId: config.clientID,
    clientSecret: config.clientSecret,
    clientAssertionSigningKey: config.clientAssertionSigningKey,
    clientAssertionSigningAlg: config.clientAssertionSigningAlg,
    authorizationParams: {
      ...config.authorizationParams,
      redirect_uri: createRouteUrl(
        config.routes.callback,
        config.baseURL,
      ).toString(),
    },
    transactionStore: new CookieTransactionStore(
      {
        secret: config.session.secret,
      },
      new HonoCookieHandler(),
    ),
    stateStore: config.session.store
      ? new StatefulStateStore(
          {
            ...config.session,
            secret: config.session.secret,
            store: config.session.store,
          },
          new HonoCookieHandler(),
        )
      : new StatelessStateStore(
          {
            ...config.session,
            secret: config.session.secret,
          },
          new HonoCookieHandler(),
        ),
    stateIdentifier: config.session.cookie?.name ?? "appSession",
    customFetch: config.fetch,
  });
}
