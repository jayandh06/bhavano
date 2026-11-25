import { NextRequest } from "next/server";
import { BASE_PATH } from "@/lib/basePath";

/**
 * Puts this build's base path back on an incoming Auth.js request.
 *
 * Next strips its `basePath` ("/us" in the US build) before a route handler runs, so the handler sees `/api/auth/csrf`. Auth.js takes its own base
 * path from the pathname of `AUTH_URL` (`https://www.bhavano.com/us/api/auth` for the US build) and requires incoming paths to start with it, so it
 * answered every request with `UnknownAction: Cannot parse action at /api/auth/csrf` (HTTP 400). That AUTH_URL path is also what makes it build
 * the right outgoing URLs (the Google callback is `/us/api/auth/callback/google`), so it cannot simply be shortened; restoring the prefix on the way
 * in satisfies both. With no base path (India) the request is returned untouched.
 */
export function restoreBasePath(req: NextRequest, basePath: string = BASE_PATH): NextRequest {
  if (!basePath) return req;
  const url = new URL(req.url);
  if (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)) return req;
  url.pathname = `${basePath}${url.pathname}`;
  return new NextRequest(url, req);
}
