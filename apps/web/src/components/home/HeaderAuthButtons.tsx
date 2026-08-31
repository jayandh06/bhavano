"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { slugify } from "@bhavano/types/slugify";
import { useAuthGate } from "./AuthGateProvider";
import { signOutAction } from "@/app/actions/auth";
import { useClickOutside } from "@/lib/useClickOutside";
import { Icon } from "./Icon";

export function HeaderAuthButtons({ userName, cityName }: { userName?: string | null; cityName?: string }) {
  const { requireLogin } = useAuthGate();
  // Carries the currently-selected city through to every account/static page below — without
  // it, PageHeader/Footer on those pages fall back to their own generic defaults (Bengaluru, no
  // footer area links) regardless of what the user actually had selected here. With no city
  // selected (national browsing) the param is omitted entirely rather than sent as an empty
  // string, which would resolve to no city and look like a bug in the URL.
  const cityQuery = cityName ? `?city=${slugify(cityName)}` : "";

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
      {/* Desktop keeps these as top-level links, where there is room for words. On a phone they
        * move into the account menu — the same place My listings already lives — so the first
        * row holds only identity. Both need an account anyway, so nothing is lost by putting
        * them behind one. */}
      <Link href={`/favourites${cityQuery}`} className="hidden sm:inline-block text-text text-sm font-bold whitespace-nowrap">
        <Icon name="heart" /> Favourites
      </Link>
      <Link href={`/messages${cityQuery}`} className="hidden sm:inline-block text-text text-sm font-bold whitespace-nowrap">
        <Icon name="message" /> Messages
      </Link>
      {userName ? (
        <AccountMenu userName={userName} cityQuery={cityQuery} />
      ) : (
        <button
          onClick={() => requireLogin()}
          className="bg-transparent border-0 text-text text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Login
        </button>
      )}
    </div>
  );
}

const menuItemClass = "block px-3.5 py-2.5 text-sm font-semibold text-text";

function AccountMenu({ userName, cityQuery }: { userName: string; cityQuery: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      {/* The name is user-supplied and unbounded — a long one stretched this button until it
        * pushed the theme toggle off the row entirely. Capped and truncated instead, with the
        * caret held outside the truncating span so it never disappears with the overflow. The
        * full name is still available on hover and to a screen reader. */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={userName}
        className="flex items-center gap-1.5 min-w-0 max-w-[7rem] sm:max-w-[10rem] bg-transparent border-0 text-text text-sm font-bold cursor-pointer"
      >
        <span className="truncate">{userName}</span>
        <span className="text-[10px] text-muted shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 bg-surface border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 w-[13rem] overflow-hidden">
          <Link href={`/profile${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
            Profile
          </Link>
          {/* Phone only — on desktop these are top-level links in the header row above, and
            * showing them in both places would be two routes to the same page a thumb apart. */}
          <Link href={`/favourites${cityQuery}`} onClick={() => setOpen(false)} className={`${menuItemClass} sm:hidden`}>
            <Icon name="heart" /> Favourites
          </Link>
          <Link href={`/messages${cityQuery}`} onClick={() => setOpen(false)} className={`${menuItemClass} sm:hidden`}>
            <Icon name="message" /> Messages
          </Link>
          <Link href={`/my-listings${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
            My listings
          </Link>
          <Link href={`/premium${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
            <Icon name="featured" /> Bhavano Plus
          </Link>
          <Link href={`/saved-searches${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
            <Icon name="bell" /> Saved searches
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
