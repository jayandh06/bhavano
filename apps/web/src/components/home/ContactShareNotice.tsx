"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getContactSharePreferenceAction } from "@/app/actions/users";

/** One line under the contact area of a listing page, for a logged-in visitor, while the owner-sees-your-number feature is on and this person is shareable.
 * Fetched after load (it is about the visitor, not the ad), so the server-rendered listing page is unchanged. */
export function ContactShareNotice() {
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getContactSharePreferenceAction().then((p) => {
      if (!cancelled && p?.enabled && p.sharing) setSharing(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sharing) return null;
  return (
    <p className="m-0 mt-1 text-[12px] text-muted">
      Owners of Featured ads may call you on your verified number.{" "}
      <Link href="/profile" className="font-bold text-green underline">
        Manage
      </Link>
    </p>
  );
}
