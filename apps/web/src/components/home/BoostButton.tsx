"use client";

import { useState } from "react";
import type { ListingCategory } from "@bhavano/types";
import { useBoost } from "./BoostProvider";
import { Icon } from "./Icon";

/** "Boost Ad" — the trigger only. The duration/price picker + Razorpay Checkout live in the one
 * shared `BoostProvider` modal (docs/plans/monetization-boosted-listings-premium-tiers.md); this
 * keeps just the button and the local "Boost pending…" state, since the boost only activates
 * once the BFF webhook confirms payment, not on the checkout callback. */
export function BoostButton({ listingId, category }: { listingId: string; category: ListingCategory }) {
  const { boost } = useBoost();
  const [pendingActivation, setPendingActivation] = useState(false);

  if (pendingActivation) {
    return <span className="text-[13px] font-bold text-green whitespace-nowrap">Boost pending…</span>;
  }

  return (
    <button
      onClick={() => boost({ listingId, category, onActivating: () => setPendingActivation(true) })}
      className="text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-3.5 py-2 whitespace-nowrap cursor-pointer bg-transparent"
    >
      <Icon name="boost" /> Boost Ad
    </button>
  );
}
