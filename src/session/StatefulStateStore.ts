import {
  EncryptedStoreOptions,
  LogoutTokenClaims,
  StateData,
} from "@auth0/auth0-server-js";
import type {
  SessionConfiguration,
  SessionCookieOptions,
  SessionStore,
} from "../types/session.js";
import { AbstractSessionStore } from "./AbstractSessionStore.js";
import { CookieHandler, CookieSerializeOptions } from "./CookieHandler.js";

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
  #cookieHandler: CookieHandler;

  constructor(
    options: StatefulStateStoreOptions & SessionConfiguration,
    cookieHandler: CookieHandler,
  ) {
    super(options);
    this.#cookieHandler = cookieHandler;
    this.#store = options.store;
    this.#cookieOptions = options.cookie;
  }

  async set(
    identifier: string,
    stateData: StateData,
    removeIfExists?: boolean,
  ): Promise<void> {
    let sessionId = await this.getSessionId(identifier);

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
    const cookieOpts: CookieSerializeOptions = {
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
    this.#cookieHandler.setCookie(identifier, encryptedStateData, cookieOpts);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const sessionId = await this.getSessionId(identifier);

    if (sessionId) {
      const stateData = await this.#store.get(sessionId);

      // If we have a session cookie, but no `stateData`, we should remove the cookie.
      if (!stateData) {
        this.#cookieHandler.deleteCookie(identifier);
      }

      return stateData;
    }
  }

  async delete(identifier: string): Promise<void> {
    const sessionId = await this.getSessionId(identifier);

    if (sessionId) {
      await this.#store.delete(sessionId);
    }
    this.#cookieHandler.deleteCookie(identifier);
  }

  private async getSessionId(identifier: string) {
    const cookieValue = this.#cookieHandler.getCookie(identifier);
    if (cookieValue) {
      const sessionCookie = await this.decrypt<{ id: string }>(
        identifier,
        cookieValue,
      );
      return sessionCookie.id;
    }
  }

  deleteByLogoutToken(claims: LogoutTokenClaims): Promise<void> {
    return this.#store.deleteByLogoutToken(claims);
  }
}
