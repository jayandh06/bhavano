"use client";

import { useEffect, useState } from "react";
import { GUEST_SAVES_EVENT, type GuestSavesEventDetail } from "@/lib/guestSaves";
import { useAuthGate } from "./AuthGateProvider";
import { Icon } from "./Icon";

/** After a logged-out save: says it's only on this device and offers a login, which moves it (and
 * any others) to the account through GuestSavesSync. */
export function GuestSavesToast() {
  const { requireLogin } = useAuthGate();
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    function onChange(e: Event) {
      const detail = (e as CustomEvent<GuestSavesEventDetail>).detail;
      if (!detail) return;
      setSavedCount(detail.savedCount);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSavedCount(null), 6000);
    }
    window.addEventListener(GUEST_SAVES_EVENT, onChange);
    return () => {
      window.removeEventListener(GUEST_SAVES_EVENT, onChange);
      window.clearTimeout(timer);
    };
  }, []);

  if (savedCount === null) return null;
  return (
    <div
      role="status"
      className="fixed z-[150] bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[420px] flex items-center gap-3 bg-[var(--toast-bg)] text-[var(--toast-text)] px-4 py-3 rounded-xl text-[13px] shadow-lg animate-[fadein_0.2s_ease_both]"
    >
      <Icon name="heart" filled />
      <span className="flex-1">
        {savedCount === 1 ? "Saved on this device." : `${savedCount} homes saved on this device.`} Log in to keep
        them on any phone.
      </span>
      <button
        type="button"
        onClick={() => {
          setSavedCount(null);
          requireLogin();
        }}
        className="bg-transparent border border-current text-inherit rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer whitespace-nowrap"
      >
        Log in
      </button>
    </div>
  );
}
