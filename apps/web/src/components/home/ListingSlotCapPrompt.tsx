"use client";

import Link from "next/link";
import type { ListingSlotCapErrorBody } from "@bhavano/types/listingSlots";

export function ListingSlotCapPrompt({ slotCap }: { slotCap: ListingSlotCapErrorBody }) {
  return (
    <div className="border border-[#b3413a] rounded-xl p-4 bg-[#b3413a]/5 text-[13px]">
      <p className="font-bold text-text m-0 mb-2">{slotCap.message}</p>
      <p className="text-muted m-0 mb-3">
        You&apos;re using {slotCap.activeCount} of {slotCap.allowance} slots.
      </p>
      <div className="flex flex-wrap gap-3">
        {slotCap.upsell.includes("sellerSlotPack") && (
          <Link href="/premium#seller-slots" className="text-green font-bold">
            Seller pack — 10 slots (₹149/mo)
          </Link>
        )}
        {slotCap.upsell.includes("agentPro") && (
          <Link href="/premium#agent-pro" className="text-green font-bold">
            Agent Pro — 20 slots (₹499/mo)
          </Link>
        )}
        <Link href="/my-listings" className="text-muted font-bold">
          Manage listings
        </Link>
      </div>
    </div>
  );
}
