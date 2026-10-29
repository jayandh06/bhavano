/** One click on the post flow's Featured-offer screen or its "Your ad is live!" screen, written as
 * a synthetic page visit so the admin's Page visits trail shows it next to the steps around it
 * (same trick as the wizard's `/post/error`, `/post/boost-recovery` and `/post/login-required`
 * writes). GTM/GA4 sees some of these separately via pushDataLayerEvent; that never reaches the
 * trail, which only reads PageView rows.
 *
 * The path is `/post/action?screen=<offer|live>&event=<name>[&days=<n>]`. Deliberately not under
 * `/post/offer` or `/post/success`: the admin funnel counts sessions by path prefix, and a click
 * must not read as another arrival at that step. Decoded by the admin app's `trailEntry()`.
 * Best-effort and fire-and-forget: a dropped write must never affect the screen. */
// "boost" is the Featured dialog opened from My listings (or a deep link), outside the post flow, so a purchase made
// days after posting still leaves a trail in Page visits (docs/plans/admin-purchases-trail.md).
// "upsell" is the "make your ad Featured" prompt (dialog on My listings, card on the owner's listing page): events shown / clicked / dismissed, with `surface`.
export type PostActionScreen = "offer" | "live" | "boost" | "upsell";

export function reportPostAction(screen: PostActionScreen, event: string, detail?: { days?: number; surface?: string }) {
  const days = (detail?.days != null ? `&days=${detail.days}` : "") + (detail?.surface ? `&surface=${encodeURIComponent(detail.surface)}` : "");
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/post/action?screen=${screen}&event=${encodeURIComponent(event)}${days}` }),
    keepalive: true,
  }).catch(() => {
    // Offline or navigated away mid-flight, same stance as StepTracker's own write.
  });
}
