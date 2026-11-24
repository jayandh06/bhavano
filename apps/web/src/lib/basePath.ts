/**
 * The URL prefix this build is served under: empty for www.bhavano.com (India) and "/us" for the US build, which is the same app built
 * with `NEXT_PUBLIC_BASE_PATH=/us` (see docs/plans/us-stack-setup.md). Next prefixes its own links, assets and redirects with it; a plain
 * `fetch("/api/...")` or `sendBeacon` is not, so those go through `withBasePath`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** `path` (starting with "/") under this build's base path. */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
