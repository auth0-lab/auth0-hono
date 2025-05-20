export const enforceLeadingSlash = (path: string) => {
  return path.split("")[0] === "/" ? path : "/" + path;
};

export function toSearchParams(
  params: Record<string, string | number | undefined>,
): URLSearchParams {
  const entries = Object.entries(params)
    .filter((entry): entry is [string, string | number] => {
      return entry[1] !== undefined;
    })
    .map(([key, value]: [string, string | number]) => {
      return [key, String(value)] as [string, string];
    });
  return new URLSearchParams(entries);
}

/**
 * Validates a redirect URL to prevent open redirects
 *
 * @param url The URL to validate
 * @param baseURL Optional base URL to validate against (for absolute URLs)
 * @returns A safe URL to redirect to
 */
export function validateRedirectUrl(url: string, baseURL?: string): string {
  // If the URL is empty or undefined, return the default path
  if (!url) {
    return "/";
  }

  // Allow relative URLs that start with /
  if (url.startsWith("/")) {
    // Prevent protocol-relative URLs like //evil.com
    if (url.startsWith("//")) {
      return "/";
    }
    return url;
  }

  // For absolute URLs, validate they belong to the same site
  if (baseURL) {
    try {
      const redirectUrl = new URL(url);
      const base = new URL(baseURL);
      // Check if the URL belongs to the same host
      if (redirectUrl.hostname === base.hostname) {
        return url;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return "/"; // If the URL is invalid, return the default path
    }
  }
  // If we reach here, the URL is not safe, return the default path
  return "/";
}

/**
 * Ensures the value does not have a leading slash.
 * If it does, it will trim it.
 * @param value The value to ensure has no leading slash.
 * @returns The value without a leading slash.
 */
function ensureNoLeadingSlash(value: string) {
  return value && value.startsWith("/")
    ? value.substring(1, value.length)
    : value;
}

/**
 * Ensures the value has a trailing slash.
 * If it does not, it will append one.
 * @param value The value to ensure has a trailing slash.
 * @returns The value with a trailing slash.
 */
function ensureTrailingSlash(value: string) {
  return value && !value.endsWith("/") ? `${value}/` : value;
}

/**
 * Utility function to ensure Route URLs are created correctly when using both the root and subpath as base URL.
 * @param url The URL to use.
 * @param base The base URL to use.
 * @returns A URL object, combining the base and url.
 */
export function createRouteUrl(url: string, base: string) {
  return new URL(ensureNoLeadingSlash(url), ensureTrailingSlash(base));
}

/**
 * Function to ensure a redirect URL is safe to use, as in, it has the same origin as the safeBaseUrl.
 * @param dangerousRedirect The redirect URL to check.
 * @param safeBaseUrl The base URL to check against.
 * @returns A safe redirect URL or undefined if the redirect URL is not safe.
 */
export function toSafeRedirect(
  dangerousRedirect: string,
  safeBaseUrl: string,
): string | undefined {
  let url: URL;

  try {
    url = createRouteUrl(dangerousRedirect, safeBaseUrl);
  } catch {
    return undefined;
  }

  if (url.origin === new URL(safeBaseUrl).origin) {
    return url.toString();
  }

  return undefined;
}
