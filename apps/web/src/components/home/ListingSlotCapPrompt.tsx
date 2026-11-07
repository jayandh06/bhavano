"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { ListingSlotCapErrorBody } from "@bhavano/types/listingSlots";
import { reportPostAction } from "@/lib/postActionTrail";

/** The "your slots are full" notice. `where` is the page-visits surface: "category" (shown before the form is filled in) or "review" (publish was refused).
 * The upgrade links are the main action; `onCheckAgain` (review only) lets someone who just closed an ad try publishing again. */
export function ListingSlotCapPrompt({
  slotCap,
  where,
  onCheckAgain,
}: {
  slotCap: ListingSlotCapErrorBody;
  where: "category" | "review";
  onCheckAgain?: () => void;
}) {
  useEffect(() => {
    reportPostAction("slotcap", "shown", { surface: where });
  }, [where]);

  const pack = slotCap.upsell.includes("sellerSlotPack") ? slotCap.offers?.sellerSlotPack : undefined;
  const pro = slotCap.upsell.includes("agentPro") ? slotCap.offers?.agentPro : undefined;
  const click = (what: string) => () => reportPostAction("slotcap", "clicked", { surface: `${where}_${what}` });
  const upgradeClass = "inline-block rounded-lg bg-green text-on-green font-bold px-4 py-2.5 no-underline";

  return (
    <div role="region" aria-label="Listing slots full" className="border border-[#b3413a] rounded-xl p-4 bg-[#b3413a]/5 text-[13px]">
      <p className="font-bold text-text m-0 mb-1">{slotCap.message}</p>
      <p className="text-muted m-0 mb-3">
        You&apos;re using {slotCap.activeCount} of {slotCap.allowance} slots.
        {where === "category" ? " You can fill in your ad now and post it once there is a free slot." : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {pack && (
          <Link href="/premium#seller-slots" onClick={click("pack")} className={upgradeClass}>
            Get {pack.totalSlots} slots · ₹{pack.monthlyPrice}/month
          </Link>
        )}
        {pro && (
          <Link
            href="/premium#agent-pro"
            onClick={click("pro")}
            className={pack ? "text-green font-bold" : upgradeClass}
          >
            Agent Pro · {pro.totalSlots} slots · ₹{pro.monthlyPrice}/month
          </Link>
        )}
        <Link href="/my-listings" onClick={click("manage")} className="text-muted font-bold">
          Close an ad
        </Link>
        {onCheckAgain && (
          <button
            type="button"
            onClick={() => {
              reportPostAction("slotcap", "check_again", { surface: where });
              onCheckAgain();
            }}
            className="bg-transparent border-0 p-0 text-muted font-bold underline cursor-pointer"
          >
            I closed one, try again
          </button>
        )}
      </div>
    </div>
  );
}
