import Link from "next/link";
import type { UserProfileDto } from "@bhavano/types";
import { buildMarket } from "@/lib/marketRobots";

export function ListingSlotMeter({ profile }: { profile: UserProfileDto }) {
  const { activeListingCount, listingSlotAllowance } = profile;
  const atCap = activeListingCount >= listingSlotAllowance;

  return (
    <div
      className={`text-[13px] mb-5 px-4 py-3 rounded-xl border ${atCap ? "border-[#b3413a] bg-[#b3413a]/5" : "border-border bg-surface"}`}
    >
      <span className="font-bold text-text">
        Active listings: {activeListingCount}/{listingSlotAllowance}
      </span>
      {atCap ? (
        <p className="text-muted m-0 mt-1">
          {buildMarket().paymentsEnabled ? (
            <>
              You&apos;re at your limit. Remove an ad, wait for one to expire, or{" "}
              <Link href="/premium" className="text-green font-bold">
                upgrade for more slots
              </Link>
              .
            </>
          ) : (
            <>You&apos;re at your limit. Remove an ad or wait for one to expire.</>
          )}
        </p>
      ) : (
        <p className="text-muted m-0 mt-1">Each active ad uses one slot until it expires or you remove it.</p>
      )}
    </div>
  );
}
