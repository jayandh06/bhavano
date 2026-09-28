/** Display form of a Page-visits trail entry.
 *
 * The web wizard writes `/post/error?stage=publish&reason=...` when Publish or checkout fails
 * (see reportPostError in the web PostAdWizard) — PageView stores only a path, so the reason rides
 * in the query string, percent-encoded. Shown decoded and flagged so an error reads as one at a
 * glance instead of as a page nobody visited. */
export function trailEntry(path: string): { text: string; isError: boolean } {
  if (!path.startsWith("/post/error")) return { text: path, isError: false };
  try {
    const params = new URL(path, "https://x.invalid").searchParams;
    const stage = params.get("stage") ?? "unknown";
    const reason = params.get("reason") ?? "";
    return { text: `Error on ${stage}${reason ? ` — ${reason}` : ""}`, isError: true };
  } catch {
    return { text: path, isError: true };
  }
}
