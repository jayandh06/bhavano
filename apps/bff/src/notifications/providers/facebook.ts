/** Graph API version pinned rather than floating — same reasoning as WhatsappProvider's
 * DEFAULT_API_VERSION: Meta deprecates versions on a schedule, and a silently-shifting default is
 * how a working integration breaks on a date nobody wrote down. */
export const DEFAULT_FACEBOOK_API_VERSION = 'v23.0';

export type FacebookPostResult =
  | { ok: true; postId: string; status: number; responseText: string }
  | { ok: false; status?: number; responseText?: string; error?: string };

/**
 * Posts a link to a Facebook Page's feed via Meta's Graph API.
 *
 * A link post (`/feed` + `link`), not a photo upload (`/photos`): Facebook's own scraper reads
 * the target page's Open Graph tags to build the preview card (image, title, description), so
 * this needs no CDN image URL of its own and can never drift out of sync with the listing's real
 * first photo — see docs/plans/facebook-page-publishing.md for the fuller tradeoff.
 *
 * Plain function, not a NestJS provider, so the one-off backfill script
 * (scripts/backfill-facebook-posts.ts) can call it directly without bootstrapping Nest's DI
 * container — `FacebookProvider` is the DI-aware wrapper for the live request path.
 *
 * No retry — single attempt, same as every other provider in this folder.
 */
export async function postToFacebookPage(params: {
  pageId: string;
  accessToken: string;
  apiVersion: string;
  message: string;
  link: string;
}): Promise<FacebookPostResult> {
  const url = `https://graph.facebook.com/${params.apiVersion}/${params.pageId}/feed`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        link: params.link,
        access_token: params.accessToken,
      }),
    });
    const responseText = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, responseText };
    }
    // Graph API's success body for a /feed post is `{ "id": "<page-id>_<post-id>" }`. Treated as
    // a failure if it's missing even on a 200 — seen from other Graph endpoints returning a
    // 200 with an error payload when a permission is present but scoped wrong.
    const parsed = JSON.parse(responseText) as { id?: string };
    if (!parsed.id) {
      return { ok: false, status: res.status, responseText };
    }
    return { ok: true, postId: parsed.id, status: res.status, responseText };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
