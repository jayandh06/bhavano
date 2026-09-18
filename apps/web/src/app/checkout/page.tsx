import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * Entry point for the Boost/Instant Alerts links in outbound messages, which forwards to the real
 * screen.
 *
 * It exists because of where a WhatsApp template's button URL comes from. A dynamic URL button is
 * a **fixed base** registered on the template when it was approved, plus a per-send suffix — and
 * `ad_boost_instant_alert` was approved with the base `https://www.bhavano.com/checkout?plan=boost&ad=`.
 * Nothing in this codebase can change that without a new template and a fresh Meta approval, so
 * `/checkout` is made real rather than left as a 404: the suffix carries the listing id, this route
 * turns it into `/my-listings?openBoost=<id>` (where `AutoOpenPurchaseModal` opens the payment
 * screen for that ad), and the seller ends up exactly where the email's buttons land.
 *
 * `ad` is read permissively on purpose. Messages already sent carry the older suffix form
 * (`my-listings?openBoost=<id>`, which lands here as `ad=my-listings?openBoost=<id>`), and those
 * buttons stay tappable for as long as the message sits in someone's chat history — so the id is
 * extracted from either shape rather than assumed.
 *
 * `plan` is accepted and ignored: Boost and Boost-with-alerts are the same screen, distinguished by
 * `withAlerts`, and a value nobody reads is better than a redirect that 404s on an unfamiliar one.
 */
export const metadata: Metadata = {
  title: "Boost your ad",
  // A redirect has nothing to index, and an indexed /checkout competing with /my-listings would be
  // worse than nothing.
  robots: { index: false, follow: false },
};

/** The listing id out of either suffix form — a bare id, or the whole `my-listings?openBoost=<id>`
 * string an already-delivered button carries. Anything else yields undefined, and the visitor goes
 * to their listings rather than to a broken modal. */
export function listingIdFromAdParam(ad: string | undefined): string | undefined {
  if (!ad) return undefined;
  const fromQuery = /openBoost=([^&?]+)/.exec(ad);
  const candidate = (fromQuery?.[1] ?? ad).trim();
  // Listing ids are uuids (bulk-imported rows) or cuids — both are id-shaped and nothing else in
  // these links is, so one permissive check covers both without pretending to validate format.
  return /^[A-Za-z0-9_-]{16,}$/.test(candidate) ? candidate : undefined;
}

export default async function CheckoutRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const listingId = listingIdFromAdParam(first(sp.ad));
  if (!listingId) redirect("/my-listings");

  // `withAlerts` arrives as its own param: the suffix `<id>&withAlerts=1` appends past the
  // template's base, so it parses as a sibling of `ad`, not as part of it.
  const withAlerts = first(sp.withAlerts) === "1" || first(sp.ad)?.includes("withAlerts=1");
  redirect(`/my-listings?openBoost=${encodeURIComponent(listingId)}${withAlerts ? "&withAlerts=1" : ""}`);
}
