"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAuthGate } from "./AuthGateProvider";
import { signOutAction } from "@/app/actions/auth";
import { useClickOutside } from "@/lib/useClickOutside";

export function HeaderAuthButtons({ userName }: { userName?: string | null }) {
  const { requireLogin } = useAuthGate();

  return (
    <div className="flex items-center gap-3 shrink-0">
      {/* TEMP(auth-gate): posting is open without login for now. */}
      <Link
        href="/post"
        className="border-[1.5px] border-green text-green rounded-lg px-4 py-[9px] text-sm font-bold whitespace-nowrap"
      >
        + Post free ad
      </Link>
      <Link href="/favourites" className="text-text text-sm font-bold whitespace-nowrap">
        ♡ Favourites
      </Link>
      <Link href="/messages" className="text-text text-sm font-bold whitespace-nowrap">
        💬 Messages
      </Link>
      {userName ? (
        <AccountMenu userName={userName} />
      ) : (
        <button
          onClick={requireLogin}
          className="bg-transparent border-0 text-text text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Login
        </button>
      )}
    </div>
  );
}

const menuItemClass = "block px-3.5 py-2.5 text-sm font-semibold text-text";

function AccountMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-transparent border-0 text-text text-sm font-bold cursor-pointer whitespace-nowrap"
      >
        {userName} <span className="text-[10px] text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 bg-surface border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[160px] overflow-hidden">
          <Link href="/profile" onClick={() => setOpen(false)} className={menuItemClass}>
            Profile
          </Link>
          <Link href="/my-listings" onClick={() => setOpen(false)} className={menuItemClass}>
            My listings
          </Link>
          <Link href="/help" onClick={() => setOpen(false)} className={menuItemClass}>
            Help
          </Link>
          <button onClick={() => signOutAction()} className={`${menuItemClass} w-full text-left border-0 bg-transparent cursor-pointer`}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
