import { CookieHandler, CookieSerializeOptions } from "@auth0/auth0-server-js";
import { AsyncLocalStorage } from "async_hooks";
import { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class HonoCookieHandler implements CookieHandler<any> {
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

  getCookies(): Record<string, string> {
    const { req } = HonoCookieHandler.getContext();
    return Object.fromEntries(
      (req.header("Cookie") ?? "").split(";").map((cookie) => {
        const [key, ...val] = cookie.trim().split("=");
        return [key, decodeURIComponent(val.join("="))];
      }),
    );
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
