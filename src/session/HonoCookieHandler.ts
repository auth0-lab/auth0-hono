import { AsyncLocalStorage } from "async_hooks";
import { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";
import { CookieHandler, CookieSerializeOptions } from "./CookieHandler.js";

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

export class HonoCookieHandler implements CookieHandler {
  private static localStore = new AsyncLocalStorage<Context>();

  static setContext<R>(context: Context, callback: () => R): R {
    return this.localStore.run(context, callback);
  }

  private static getContext(): Context {
    const ctx = this.localStore.getStore();
    if (!ctx) {
      throw new Error("No context available. Did you call setContext?");
    }
    return ctx;
  }

  setCookie(
    name: string,
    value: string,
    options?: CookieSerializeOptions,
  ): string {
    const cookieOptions: CookieOptions | undefined = options
      ? {
          ...options,
          sameSite: options.sameSite ? capitalize(options.sameSite) : undefined,
          priority: options.priority ? capitalize(options.priority) : undefined,
        }
      : undefined;
    const ctx = HonoCookieHandler.getContext();
    setCookie(ctx, name, value, cookieOptions);
    return value;
  }

  getCookie(name: string): string | undefined {
    const ctx = HonoCookieHandler.getContext();
    return getCookie(ctx, name);
  }

  deleteCookie(name: string): void {
    const ctx = HonoCookieHandler.getContext();
    setCookie(ctx, name, "", { path: "/", maxAge: 0 });
  }
}
