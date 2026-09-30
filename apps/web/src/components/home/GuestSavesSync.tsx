"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { importGuestSavesAction } from "@/app/actions/listings";
import { clearGuestSaves, readGuestSaveIds } from "@/lib/guestSaves";

/** Mounted for logged-in visitors: moves anything saved on this device while logged out onto the
 * account, then refreshes so the hearts and Favourites show it. */
export function GuestSavesSync() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ids = readGuestSaveIds();
    if (ids.length === 0) return;
    void importGuestSavesAction(ids).then((result) => {
      if (!result) return;
      clearGuestSaves();
      router.refresh();
    });
  }, [router]);

  return null;
}
