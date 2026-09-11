import type { Metadata } from "next";
import { ClaimListing } from "@/components/home/ClaimListing";

/** Reached only from a private outreach link (email or WhatsApp) sent to one specific business —
 * never linked from anywhere crawlable, and there's nothing here for a reader anyway. noindex so
 * it never competes with the real listing page for that same URL's worth of ranking. */
export const metadata: Metadata = {
  title: "Verify your listing — Bhavano",
  robots: { index: false, follow: false },
};

export default async function ClaimListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  const { id } = await params;
  const { via } = await searchParams;
  // Which outreach channel's link was actually clicked — see Listing.claimSource. Anything other
  // than the two real channels is dropped rather than forwarded (matches the BFF's own
  // via === 'email' || via === 'whatsapp' check), so a malformed/missing param never becomes a
  // claim with bogus source data.
  const source = via === "email" || via === "whatsapp" ? via : undefined;
  return <ClaimListing listingId={id} source={source} />;
}
