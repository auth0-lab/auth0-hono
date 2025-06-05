import {
  BackchannelLogoutError,
  EncryptedStoreOptions,
  StateData,
} from "@auth0/auth0-server-js";
import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";
import { MissingContextError } from "../errors/index.js";
import type {
  SessionConfiguration,
  SessionCookieOptions,
} from "../types/session.js";
import { AbstractSessionStore } from "./AbstractSessionStore.js";

export class StatelessStateStore extends AbstractSessionStore {
  readonly #cookieOptions: SessionCookieOptions | undefined;

  constructor(options: SessionConfiguration & EncryptedStoreOptions) {
    super(options);
    this.#cookieOptions = options.cookie;
  }

  async set(
    identifier: string,
    stateData: StateData,
    removeIfExists?: boolean,
    c?: Context | undefined,
  ): Promise<void> {
    // We can not handle cookies in Fastify when the `Context` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    const maxAge = this.calculateMaxAge(stateData.internal.createdAt);
    const cookieOpts: CookieOptions = {
      httpOnly: true,
      sameSite: this.#cookieOptions?.sameSite ?? "lax",
      path: "/",
      secure: this.#cookieOptions?.secure ?? true,
      // todo
      // secure: this.#cookieOptions?.secure ?? "auto",
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
    const chunks = [...Array(chunkCount).keys()].map((i) => ({
      value: encryptedStateData.substring(i * chunkSize, (i + 1) * chunkSize),
      name: `${identifier}.${i}`,
    }));

    chunks.forEach((chunk) => {
      setCookie(c, chunk.name, chunk.value, cookieOpts);
    });

    const existingCookieKeys = this.getCookieKeys(identifier, c);
    const cookieKeysToRemove = existingCookieKeys.filter(
      (key) => !chunks.some((chunk) => chunk.name === key),
    );
    cookieKeysToRemove.forEach((key) => {
      deleteCookie(c, key);
    });
  }

  async get(
    identifier: string,
    c?: Context | undefined,
  ): Promise<StateData | undefined> {
    // We can not handle cookies in Fastify when the `Context` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    const cookieKeys = this.getCookieKeys(identifier, c);
    const encryptedStateData = cookieKeys
      .map((key) => ({
        index: parseInt(key.split(".")[1] as string, 10),
        value: getCookie(c, key),
      }))
      .sort((a, b) => a.index - b.index)
      .map((item) => item.value)
      .join("");

    if (encryptedStateData) {
      return (await this.decrypt(identifier, encryptedStateData)) as StateData;
    }
  }

  async delete(identifier: string, c?: Context | undefined): Promise<void> {
    // We can not handle cookies in Fastify when the `Context` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    const cookieKeys = this.getCookieKeys(identifier, c);
    for (const key of cookieKeys) {
      deleteCookie(c, key);
    }
  }

  async deleteByLogoutToken(): Promise<void> {
    throw new BackchannelLogoutError(
      "Backchannel logout is not available when using Stateless Storage. Use Stateful Storage by providing a `sessionStore`",
    );
  }

  private getCookieKeys(identifier: string, c: Context): string[] {
    const cookies = c.req.raw.headers.get("cookie") || "";
    return cookies
      .split(";")
      .map((cookie: string) => cookie.trim().split("=")[0])
      .filter((name: string) => name.length > 0 && name.startsWith(identifier));
  }
}
