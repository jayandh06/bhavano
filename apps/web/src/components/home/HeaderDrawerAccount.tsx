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
      <button type="button" onClick={() => requireLogin()} className={`${row} w-full border-0 bg-transparent cursor-pointer text-left`}>
        <Icon name="user" className="text-muted" /> Log in
      </button>
    );
  }

  return (
    <>
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
