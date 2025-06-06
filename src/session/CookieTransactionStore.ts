import {
  AbstractTransactionStore,
  EncryptedStoreOptions,
  TransactionData,
} from "@auth0/auth0-server-js";
import { CookieHandler, CookieSerializeOptions } from "./CookieHandler.js";

export class CookieTransactionStore extends AbstractTransactionStore {
  #cookieHandler: CookieHandler;

  constructor(options: EncryptedStoreOptions, cookieHandler: CookieHandler) {
    super(options);
    this.#cookieHandler = cookieHandler;
  }

  async set(
    identifier: string,
    transactionData: TransactionData,
  ): Promise<void> {
    const maxAge = 60 * 60;
    const cookieOpts: CookieSerializeOptions = {
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
    this.#cookieHandler.setCookie(identifier, encryptedStateData, cookieOpts);
  }

  async get(identifier: string): Promise<TransactionData | undefined> {
    const cookieValue = this.#cookieHandler.getCookie(identifier);

    if (cookieValue) {
      return await this.decrypt(identifier, cookieValue);
    }
  }

  async delete(identifier: string): Promise<void> {
    this.#cookieHandler.deleteCookie(identifier);
  }
}
