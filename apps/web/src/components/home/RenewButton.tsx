"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { renewListingAction } from "@/app/actions/listings";

/** "Renew" on /my-listings — pushes expiresAt forward by another 30 days. Unlike BoostButton
 * there's no payment step; the only failure worth special-casing is the slot cap, which gets the
 * same upsell copy ListingSlotMeter shows. See docs/plans/finish-listing-renewal-ui-and-history.md. */
export function RenewButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atCap, setAtCap] = useState(false);

  async function onRenew() {
    setPending(true);
    setError(null);
    setAtCap(false);

    const result = await renewListingAction(listingId);
    setPending(false);

    if (!result.success) {
      if (result.slotCap) setAtCap(true);
      else setError(result.error);
      return;
    }

    router.refresh();
  }

  if (atCap) {
    return (
      <span className="text-[12px] text-muted">
        You&apos;re at your limit.{" "}
        <Link href="/premium" className="text-green font-bold">
          Upgrade for more slots
        </Link>
        .
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onRenew}
        disabled={pending}
        className="text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-3.5 py-2 whitespace-nowrap cursor-pointer bg-transparent disabled:opacity-50"
      >
        {pending ? "Renewing…" : "Renew"}
      </button>
      {error && <span className="text-[#b3413a] text-[12px]">{error}</span>}
    </div>
  );
}
