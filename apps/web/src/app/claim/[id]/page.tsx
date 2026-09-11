import type { Metadata } from "next";
import { ClaimListing } from "@/components/home/ClaimListing";

/** Reached only from a private WhatsApp link sent to one specific business — never linked from
 * anywhere crawlable, and there's nothing here for a reader anyway. noindex so it never competes
 * with the real listing page for that same URL's worth of ranking. */
export const metadata: Metadata = {
  title: "Verify your listing — Bhavano",
  robots: { index: false, follow: false },
};

export default async function ClaimListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimListing listingId={id} />;
}
