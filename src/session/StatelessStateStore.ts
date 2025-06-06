import {
  BackchannelLogoutError,
  EncryptedStoreOptions,
  StateData,
} from "@auth0/auth0-server-js";
import type {
  SessionConfiguration,
  SessionCookieOptions,
} from "../types/session.js";
import { AbstractSessionStore } from "./AbstractSessionStore.js";
import { CookieHandler, CookieSerializeOptions } from "./CookieHandler.js";

export class StatelessStateStore extends AbstractSessionStore {
  readonly #cookieOptions: SessionCookieOptions | undefined;
  readonly #cookieHandler: CookieHandler;

  constructor(
    options: SessionConfiguration & EncryptedStoreOptions,
    cookieHandler: CookieHandler,
  ) {
    super(options);
    this.#cookieOptions = options.cookie;
    this.#cookieHandler = cookieHandler;
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    const maxAge = this.calculateMaxAge(stateData.internal.createdAt);
    const cookieOpts: CookieSerializeOptions = {
      httpOnly: true,
      sameSite: this.#cookieOptions?.sameSite ?? "lax",
      path: "/",
      secure: this.#cookieOptions?.secure ?? true,
      maxAge,
    };
    const expiration = Math.floor(Date.now() / 1000 + maxAge);
    const encryptedStateData = await this.encrypt(
      identifier,
      stateData,
      expiration,
    );

    const chunkSize = 3072;
    const chunkCount = Math.ceil(encryptedStateData.length / chunkSize);
    if (chunkCount > 10) {
      throw new Error(
        `State data for identifier "${identifier}" exceeds the maximum size of 30720 characters when encrypted. Consider using a different storage method.`,
      );
    }

    const chunks = [...Array(chunkCount).keys()].map((i) => ({
      value: encryptedStateData.substring(i * chunkSize, (i + 1) * chunkSize),
      name: `${identifier}.${i}`,
    }));

    for (let i = 0; i < 10; i++) {
      if (i < chunkCount) {
        this.#cookieHandler.setCookie(
          chunks[i].name,
          chunks[i].value,
          cookieOpts,
        );
      } else {
        this.#cookieHandler.deleteCookie(`${identifier}.${i}`);
      }
    }
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const encryptedStateData = [...Array(10).keys()]
      .map((index) => ({
        index,
        value: this.#cookieHandler.getCookie(`${identifier}.${index}`),
      }))
      .map((item) => item.value)
      .join("");

    if (encryptedStateData) {
      return (await this.decrypt(identifier, encryptedStateData)) as StateData;
    }
  }

  async delete(identifier: string): Promise<void> {
    for (let i = 0; i < 10; i++) {
      this.#cookieHandler.deleteCookie(`${identifier}.${i}`);
    }
  }

  async deleteByLogoutToken(): Promise<void> {
    throw new BackchannelLogoutError(
      "Backchannel logout is not available when using Stateless Storage. Use Stateful Storage by providing a `sessionStore`",
    );
  }
}
