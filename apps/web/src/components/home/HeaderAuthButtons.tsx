"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { slugify } from "@bhavano/types/slugify";
import { useAuthGate } from "./AuthGateProvider";
import { signOutAction } from "@/app/actions/auth";
import { useClickOutside } from "@/lib/useClickOutside";
import { Icon } from "./Icon";
import { MessagesNavItem, UnreadCountProvider } from "./MessagesNavItem";

export function HeaderAuthButtons({
  userName,
  cityName,
  accessToken,
}: {
  userName?: string | null;
  cityName?: string;
  /** The BFF access token from the current session — drives the shared `UnreadCountProvider`
   * (fetch + socket subscription for the Messages badge). Undefined when logged out or the token
   * has expired, in which case the badge just stays empty. */
  accessToken?: string;
}) {
  const { requireLogin } = useAuthGate();
  // Carries the currently-selected city through to every account/static page below — without
  // it, PageHeader/Footer on those pages fall back to their own generic defaults (Bengaluru, no
  // footer area links) regardless of what the user actually had selected here. With no city
  // selected (national browsing) the param is omitted entirely rather than sent as an empty
  // string, which would resolve to no city and look like a bug in the URL.
  const cityQuery = cityName ? `?city=${slugify(cityName)}` : "";

  return (
    <UnreadCountProvider accessToken={accessToken}>
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
        {/* Desktop keeps these as top-level links, where there is room for words. On a phone they
          * move into the account menu — the same place My listings already lives — so the first
          * row holds only identity. Both need an account anyway, so nothing is lost by putting
          * them behind one. */}
        <Link href={`/favourites${cityQuery}`} className="hidden sm:inline-block text-text text-sm font-bold whitespace-nowrap">
          <Icon name="heart" /> Favourites
        </Link>
        <MessagesNavItem
          href={`/messages${cityQuery}`}
          className="hidden sm:inline-block text-text text-sm font-bold whitespace-nowrap"
        />
        {/* Phone only: the labelled Messages link lives in the account menu below, where a badge
          * would be invisible behind a closed dropdown — so the count rides on this
          * always-visible icon in the identity row instead. */}
        {userName && (
          <MessagesNavItem
            href={`/messages${cityQuery}`}
            showLabel={false}
            className="sm:hidden text-text inline-flex items-center"
          />
        )}
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
    </UnreadCountProvider>
  );
}

// Hover feedback + consistent icon spacing is what the plain version was missing — every item
// used to be indistinguishable text at rest, with nothing to show which one the pointer is over.
const menuItemClass =
  "flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-text hover:bg-surface-alt transition-colors duration-100";

function AccountMenu({ userName, cityQuery }: { userName: string; cityQuery: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const initial = userName.trim().charAt(0).toUpperCase();

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
        <div className="absolute top-[calc(100%+8px)] right-0 bg-surface border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 w-[15rem] overflow-hidden">
          {/* Identity header — the trigger already truncates a long name to a few characters, so
            * this is the one place in the menu where the visitor can see who they're signed in
            * as in full, plus a mark that reads as a person rather than a row of plain text. */}
          <div className="flex items-center gap-3 px-3.5 py-3 bg-surface-alt border-b border-border">
            <span className="flex items-center justify-center shrink-0 w-9 h-9 rounded-full bg-green text-on-green text-[15px] font-bold">
              {initial || <Icon name="user" />}
            </span>
            <span className="min-w-0 text-sm font-bold text-text truncate">{userName}</span>
          </div>
          <div className="py-1.5">
            <Link href={`/profile${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
              <Icon name="user" className="text-muted" /> Profile
            </Link>
            {/* Phone only — on desktop these are top-level links in the header row above, and
              * showing them in both places would be two routes to the same page a thumb apart. */}
            <Link href={`/favourites${cityQuery}`} onClick={() => setOpen(false)} className={`${menuItemClass} sm:hidden`}>
              <Icon name="heart" className="text-muted" /> Favourites
            </Link>
            <MessagesNavItem
              href={`/messages${cityQuery}`}
              onNavigate={() => setOpen(false)}
              className={`${menuItemClass} sm:hidden`}
            />
            <Link href={`/my-listings${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
              <Icon name="list" className="text-muted" /> My listings
            </Link>
            <Link href={`/premium${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
              <Icon name="featured" className="text-gold" /> Bhavano Plus
            </Link>
            <Link href={`/saved-searches${cityQuery}`} onClick={() => setOpen(false)} className={menuItemClass}>
              <Icon name="bell" className="text-muted" /> Saved searches
            </Link>
            <Link href="/help" onClick={() => setOpen(false)} className={menuItemClass}>
              <Icon name="help" className="text-muted" /> Help
            </Link>
          </div>
          {/* Its own section, divided off — the one item here that ends the session rather than
            * navigating somewhere in it, so it shouldn't sit flush against "Help" as if it were
            * one more destination in the same list. */}
          <div className="py-1.5 border-t border-border">
            <button
              onClick={() => signOutAction()}
              className={`${menuItemClass} w-full text-left border-0 bg-transparent cursor-pointer text-[#b3413a] hover:text-[#b3413a]`}
            >
              <Icon name="logout" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
