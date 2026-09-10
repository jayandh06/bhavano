"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserProfileDto } from "@bhavano/types";
import { fetchProfileAction } from "@/app/actions/users";
import { Icon } from "./Icon";

/** Reminds a logged-in user to add a missing email/phone. Refetches on every client-side
 * navigation so saving it on /profile and navigating away clears the banner without a reload.
 *
 * Dismissible per browser (7-day snooze in `localStorage`) — the sharper ask now lives in
 * ProfileCompletionDialog on a return login (docs/plans/profile-completion-dialog.md), so this
 * no longer needs to nag on every page forever.
 *
 * Rendered `position: fixed` (a bottom pill, not an in-flow top bar): it resolves after an async
 * profile fetch, and an in-flow bar appearing then would shove the whole page down — a large
 * Cumulative Layout Shift on every route for anyone with an incomplete profile. Fixed means it
 * can't move sibling content. */

const DISMISS_KEY = "bhavano_profile_banner_dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function ProfileCompletionBanner() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [dismissed, setDismissed] = useState(true); // assume hidden until the client check runs

  useEffect(() => {
    let cancelled = false;
    fetchProfileAction().then((result) => {
      if (cancelled) return;
      setProfile(result.requiresLogin ? null : result.profile);
      setDismissed(dismissedRecently());
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (dismissed || !profile) return null;

  const missing = [!profile.email && "email", !profile.phone && "phone number"].filter(Boolean) as string[];
  if (missing.length === 0) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 max-w-[92vw] bg-surface border border-border rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.14)] text-[13px] text-text-soft pl-4 pr-2 py-2 flex items-center gap-2.5">
      <span className="truncate">
        Add your {missing.join(" and ")} to your profile.{" "}
        <Link href="/profile" className="text-green font-bold whitespace-nowrap">
          Update →
        </Link>
      </span>
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="shrink-0 w-6 h-6 flex items-center justify-center bg-transparent border-0 text-muted cursor-pointer"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
