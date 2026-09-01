"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { UnreadUpdateEvent } from "@bhavano/types";
import { getSocket } from "@/lib/socket";
import { getUnreadCountAction } from "@/app/actions/messaging";
import { Icon } from "./Icon";

/**
 * One unread-count subscription shared by every `MessagesNavItem` on the page — the header
 * renders it up to three ways (desktop link, phone icon, account-menu row) and they must not
 * each open their own fetch + socket listener.
 *
 * The count starts from a server action on mount, then tracks `unread_update` events on the
 * user's own socket room (a message arrived, or a thread was read on another device), and
 * re-checks whenever the tab regains focus in case the socket slept through a change.
 */
const UnreadCountContext = createContext(0);

export function UnreadCountProvider({
  accessToken,
  children,
}: {
  accessToken?: string;
  children: ReactNode;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const refresh = () => {
      getUnreadCountAction().then((r) => {
        if (active) setCount(r.count);
      });
    };
    refresh();

    const socket = getSocket(accessToken);
    const onUnread = (e: UnreadUpdateEvent) => {
      if (active) setCount(e.unreadCount);
    };
    socket.on("unread_update", onUnread);

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      socket.off("unread_update", onUnread);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [accessToken]);

  // Gate on the token here rather than resetting state inside the effect — a logged-out render
  // just reads 0, and a stale `count` from a previous session can never leak through.
  return (
    <UnreadCountContext.Provider value={accessToken ? count : 0}>{children}</UnreadCountContext.Provider>
  );
}

/** The header's "Messages" entry with the shared unread-count badge. Layout is the caller's job
 * (it passes `className` and whether to show the label), since the same item renders as an
 * inline header link, a compact icon in the phone identity row, and a labelled account-menu
 * row. */
export function MessagesNavItem({
  href,
  className,
  showLabel = true,
  onNavigate,
}: {
  href: string;
  className?: string;
  showLabel?: boolean;
  onNavigate?: () => void;
}) {
  const count = useContext(UnreadCountContext);
  const label = count > 99 ? "99+" : String(count);
  // Same green pill the per-conversation badges use on the Messages list.
  const badgeBase = "bg-green text-on-green rounded-full font-bold leading-none";

  return (
    <Link
      href={href}
      className={className}
      onClick={onNavigate}
      aria-label={showLabel ? undefined : `Messages${count > 0 ? `, ${label} unread` : ""}`}
    >
      {showLabel ? (
        <>
          <Icon name="message" /> Messages
          {count > 0 && (
            <span className={`${badgeBase} text-[11px] ml-1.5 px-1.5 py-[2px] align-middle`}>{label}</span>
          )}
        </>
      ) : (
        <span className="relative inline-flex">
          <Icon name="message" />
          {count > 0 && (
            <span className={`${badgeBase} absolute -top-1.5 -right-2 text-[10px] px-1 py-[1px] min-w-[15px] text-center`}>
              {label}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
