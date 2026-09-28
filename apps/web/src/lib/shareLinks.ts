/**
 * UTM tags for every link a visitor or owner shares. WhatsApp and most in-app browsers send no
 * Referer, so an untagged share landed in `Visit.source = "direct"` — indistinguishable from
 * someone typing the address. middleware.ts already records utm_* on the Visit and on the
 * first-touch acquisition cookie, so tagging is all it takes to see sharing as its own channel.
 * See docs/plans/growth-beyond-google-ads.md.
 *
 * Harmless for SEO: listing and browse pages set their own canonical, which drops the params.
 */
export type ShareChannel = "whatsapp" | "copy" | "email" | "share_sheet";

/** `owner_share`: the owner sharing their own ad. `listing_share`: anyone else passing one on. */
export type ShareCampaign = "owner_share" | "listing_share";

export function taggedShareUrl(absoluteUrl: string, channel: ShareChannel, campaign: ShareCampaign): string {
  const url = new URL(absoluteUrl);
  url.searchParams.set("utm_source", channel);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

/** A ready-to-send WhatsApp message, so sharing is one tap rather than composing text. */
export function whatsappShareHref(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
}
