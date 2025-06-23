import { Configuration } from "@/config/Configuration.js";
import { HonoCookieHandler } from "@/session/HonoCookieHandler.js";
import { createRouteUrl } from "@/utils/util.js";
import {
  CookieTransactionStore,
  ServerClient,
  StatefulStateStore,
  StatelessStateStore,
} from "@auth0/auth0-server-js";
import { Context } from "vm";

/**
 * Initialize the OpenID Connect client
 */
export function initializeOidcClient(config: Configuration) {
  const cookieHandler = new HonoCookieHandler();
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
      cookieHandler,
    ),
    stateStore: config.session.store
      ? new StatefulStateStore(
          {
            ...config.session,
            secret: config.session.secret,
            store: config.session.store,
          },
          cookieHandler,
        )
      : new StatelessStateStore(
          {
            ...config.session,
            secret: config.session.secret,
          },
          cookieHandler,
        ),
    stateIdentifier: config.session.cookie?.name ?? "appSession",
    customFetch: config.fetch,
  });
}
