import {
  AbstractTransactionStore,
  TransactionData,
} from "@auth0/auth0-server-js";
import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";
import { MissingContextError } from "../errors/index.js";

export class CookieTransactionStore extends AbstractTransactionStore<Context> {
  async set(
    identifier: string,
    transactionData: TransactionData,
    removeIfExists?: boolean,
    c?: Context,
  ): Promise<void> {
    // We can not handle cookies in Fastify when the `StoreOptions` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    const maxAge = 60 * 60;
    const cookieOpts: CookieOptions = {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    };
    const expiration = Math.floor(Date.now() / 1000 + maxAge);
    const encryptedStateData = await this.encrypt(
      identifier,
      transactionData,
      expiration,
    );

    setCookie(c, identifier, encryptedStateData, cookieOpts);
  }

  async get(
    identifier: string,
    c?: Context,
  ): Promise<TransactionData | undefined> {
    // We can not handle cookies in Fastify when the `StoreOptions` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    // const cookieValue = options.request.cookies[identifier];
    const cookieValue = getCookie(c, identifier);

    if (cookieValue) {
      return await this.decrypt(identifier, cookieValue);
    }
  }

  async delete(identifier: string, c?: Context | undefined): Promise<void> {
    // We can not handle cookies in Fastify when the `StoreOptions` are not provided.
    if (!c) {
      throw new MissingContextError();
    }
    deleteCookie(c, identifier);
  }
}
