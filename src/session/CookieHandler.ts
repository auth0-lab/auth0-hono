export interface CookieSerializeOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  partitioned?: boolean;
  priority?: "low" | "medium" | "high";
}

export interface CookieHandler {
  setCookie: (
    name: string,
    value: string,
    options?: CookieSerializeOptions,
  ) => string;
  getCookie: (name: string) => string | undefined;
  deleteCookie: (name: string) => void;
}
