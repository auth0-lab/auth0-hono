import {
  EncryptedStoreOptions,
  LogoutTokenClaims,
  StateData,
} from "@auth0/auth0-server-js";
import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";
import { MissingContextError } from "../errors/index.js";
import type {
  SessionConfiguration,
  SessionCookieOptions,
  SessionStore,
} from "../types/session.js";
import { AbstractSessionStore } from "./AbstractSessionStore.js";

export interface StatefulStateStoreOptions extends EncryptedStoreOptions {
  store: SessionStore;
}

const generateId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export class StatefulStateStore extends AbstractSessionStore {
  readonly #store: SessionStore;
  readonly #cookieOptions: SessionCookieOptions | undefined;

  constructor(options: StatefulStateStoreOptions & SessionConfiguration) {
    super(options);

    this.#store = options.store;
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

    let sessionId = await this.getSessionId(identifier, c);

    // if this is a new session created by a new login we need to remove the old session
    // from the store and regenerate the session ID to prevent session fixation.
    if (sessionId && removeIfExists) {
      await this.#store.delete(sessionId);
      sessionId = generateId();
    }

    if (!sessionId) {
      sessionId = generateId();
    }

    const maxAge = this.calculateMaxAge(stateData.internal.createdAt);
    const cookieOpts: CookieOptions = {
      httpOnly: true,
      sameSite: this.#cookieOptions?.sameSite ?? "lax",
      path: "/",
      secure: this.#cookieOptions?.secure ?? true,
      //TODO: this doesn't have auto
      // secure: this.#cookieOptions?.secure ?? "auto",
      maxAge,
    };
    const expiration = Date.now() / 1000 + maxAge;
    const encryptedStateData = await this.encrypt<{ id: string }>(
      identifier,
      {
        id: sessionId,
      },
      expiration,
    );

    await this.#store.set(sessionId, stateData);

    setCookie(c, identifier, encryptedStateData, cookieOpts);
  }

  async get(
    identifier: string,
    c?: Context | undefined,
  ): Promise<StateData | undefined> {
    // We can not handle cookies in Fastify when the `Context` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    const sessionId = await this.getSessionId(identifier, c);

    if (sessionId) {
      const stateData = await this.#store.get(sessionId);

      // If we have a session cookie, but no `stateData`, we should remove the cookie.
      if (!stateData) {
        deleteCookie(c, identifier);
      }

      return stateData;
    }
  }

  async delete(identifier: string, c?: Context | undefined): Promise<void> {
    // We can not handle cookies in Fastify when the `Context` are not provided.
    if (!c) {
      throw new MissingContextError();
    }

    const sessionId = await this.getSessionId(identifier, c);

    if (sessionId) {
      await this.#store.delete(sessionId);
    }

    deleteCookie(c, identifier);
  }

  private async getSessionId(identifier: string, c: Context) {
    const cookieValue = getCookie(c, identifier);
    if (cookieValue) {
      const sessionCookie = await this.decrypt<{ id: string }>(
        identifier,
        cookieValue,
      );
      return sessionCookie.id;
    }
  }

  deleteByLogoutToken(
    claims: LogoutTokenClaims,
    options?: Context | undefined,
  ): Promise<void> {
    return this.#store.deleteByLogoutToken(claims, options);
  }
}
