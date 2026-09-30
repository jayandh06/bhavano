import { useCallback } from "react";
import type { ListingCardDto } from "@bhavano/types";
import { useHomeSheets } from "../context/HomeSheetsProvider";
import { toggleGuestSave, useGuestSaves } from "./guestSaves";

/** The logged-out half of a heart button: saves on this phone, and on the 1st and 3rd save asks
 * (skippably) to log in so the saves move to the account. */
export function useGuestSaveHeart(listingId: string) {
  const { requireLogin } = useHomeSheets();
  const guestSaved = useGuestSaves().some((item) => item.id === listingId);

  const toggle = useCallback(
    (listing: ListingCardDto) => {
      const savedCount = toggleGuestSave(listing);
      if (savedCount !== 1 && savedCount !== 3) return;
      requireLogin({
        title: "Keep your saved homes",
        skippable: {
          reason:
            savedCount === 1
              ? "Saved on this phone only. Log in to keep your saved homes on any phone."
              : `${savedCount} homes saved on this phone. Log in so you don't lose them.`,
          onSkip: () => {},
        },
      });
    },
    [requireLogin],
  );

  return { guestSaved, toggle };
}
