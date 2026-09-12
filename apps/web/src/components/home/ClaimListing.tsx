"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claimListingAction } from "@/app/actions/listings";
import { useAuthGate } from "./AuthGateProvider";

/** Where a "verify your listing on Bhavano" email or WhatsApp link lands. Not logged in → the
 * normal OTP modal (nothing new — AuthGateProvider already auto-creates a User on first-ever OTP
 * verify), then the claim is retried in place via `onSuccess` rather than reloading this page.
 * Success → straight into the edit form, since setting a real price is the entire point of the
 * nudge. `source` (email/whatsapp, from the page's own `?via=` param) is forwarded so the BFF can
 * record which channel's link was actually clicked — see Listing.claimSource. */
export function ClaimListing({ listingId, source }: { listingId: string; source?: "email" | "whatsapp" }) {
  const { requireLogin } = useAuthGate();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void attemptClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attemptClaim() {
    setError(null);
    const result = await claimListingAction(listingId, source);
    if (result.requiresLogin) {
      // phoneOnly: the backend only ever accepts a claim from an account whose own phone number
      // matches this business's phone on file (ListingsService.claimListing) — a Google/email
      // login can succeed and still always fail that check, so it's not offered here at all.
      requireLogin({ onSuccess: () => void attemptClaim(), phoneOnly: true });
      return;
    }
    if (result.success) {
      router.replace(`/my-listings/${listingId}/edit`);
      return;
    }
    setError(result.error);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg text-text p-6">
      {error ? (
        <div className="text-center max-w-sm">
          <p className="text-sm font-bold text-[#b3413a] mb-2">Couldn&apos;t verify this listing</p>
          <p className="text-sm text-muted">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">Verifying…</p>
      )}
    </div>
  );
}
