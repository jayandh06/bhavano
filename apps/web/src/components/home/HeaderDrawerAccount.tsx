"use client";

import Link from "next/link";
import { slugify } from "@bhavano/types/slugify";
import { useAuthGate } from "./AuthGateProvider";
import { signOutAction } from "@/app/actions/auth";
import { Icon } from "./Icon";

/**
 * The account section of the mobile hamburger drawer — a flat list, not a nested dropdown.
 *
 * The full header's `AccountMenu` opens a `position: absolute` popover, which inside the
 * drawer's `overflow-y-auto` box gets clipped / pushed off-screen. A hamburger menu wants every
 * destination as a plain row anyway, so this just spells the same items out inline.
 */

const row =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-text-soft hover:bg-surface-alt hover:text-text transition-colors";

export function HeaderDrawerAccount({ userName, cityName }: { userName?: string | null; cityName?: string }) {
  const { requireLogin } = useAuthGate();
  const cityQuery = cityName ? `?city=${slugify(cityName)}` : "";

  if (!userName) {
    return (
      <button
        type="button"
        onClick={() => requireLogin()}
        className="w-full inline-flex items-center justify-center gap-2 bg-green text-on-green rounded-lg px-4 py-2.5 text-sm font-bold cursor-pointer border-0 shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
      >
        <Icon name="user" /> Log in / Sign up
      </button>
    );
  }

  const initial = userName.trim().charAt(0).toUpperCase();

  return (
    <>
      {/* Whose session this is — the drawer equivalent of the desktop AccountMenu's header. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex items-center justify-center shrink-0 w-9 h-9 rounded-full bg-green text-on-green text-[15px] font-bold">
          {initial || <Icon name="user" />}
        </span>
        <span className="min-w-0 text-sm font-bold text-text truncate">{userName}</span>
      </div>

      <Link href={`/profile${cityQuery}`} className={row}>
        <Icon name="user" className="text-muted" /> Profile
      </Link>
      <Link href={`/favourites${cityQuery}`} className={row}>
        <Icon name="heart" className="text-muted" /> Favourites
      </Link>
      <Link href={`/messages${cityQuery}`} className={row}>
        <Icon name="message" className="text-muted" /> Messages
      </Link>
      <Link href={`/my-listings${cityQuery}`} className={row}>
        <Icon name="list" className="text-muted" /> My listings
      </Link>
      <Link href={`/saved-searches${cityQuery}`} className={row}>
        <Icon name="bell" className="text-muted" /> Saved searches
      </Link>
      <div className="my-1.5 border-t border-border" />
      <button
        type="button"
        onClick={() => signOutAction()}
        className={`${row} w-full border-0 bg-transparent cursor-pointer text-left text-[#b3413a] hover:text-[#b3413a]`}
      >
        <Icon name="logout" /> Logout
      </button>
    </>
  );
}
