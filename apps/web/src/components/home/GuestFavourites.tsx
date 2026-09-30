"use client";

import { useGuestSaves } from "@/lib/guestSaves";
import { useAuthGate } from "./AuthGateProvider";
import { ListingCard } from "./ListingCard";
import { RequireLoginPrompt } from "./RequireLoginPrompt";

/** Favourites for a logged-out visitor: whatever they saved on this device, with the login ask
 * that moves them to their account (GuestSavesSync runs once they're in). */
export function GuestFavourites() {
  const saves = useGuestSaves();
  const { requireLogin } = useAuthGate();
  if (saves.length === 0) {
    return <RequireLoginPrompt message="Log in to see the listings you've favourited." />;
  }
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap border border-border rounded-xl bg-surface p-4 mb-5">
        <p className="m-0 flex-1 min-w-[200px] text-sm text-text-soft">
          {saves.length === 1 ? "This home is" : `These ${saves.length} homes are`} saved on this device only. Log in to
          keep them on any phone.
        </p>
        <button
          type="button"
          onClick={() => requireLogin()}
          className="bg-green text-on-green border-0 rounded-lg px-5 py-2.5 text-sm font-bold cursor-pointer"
        >
          Log in
        </button>
      </div>
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
        {saves.map((item) => (
          <ListingCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
