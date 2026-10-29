"use client";

import { useEffect, useState } from "react";
import { getSeekerContactNoticeAction } from "@/app/actions/auth";

let cached: Promise<boolean> | null = null;

/** Whether the login screens should say that owners of Featured ads may call people who show interest (Admin -> Settings -> Seeker contact, notice mode). Off until the lookup says
 * otherwise, so nothing is claimed that is not true; made once per page load, and only once `enabled` (the login dialog is open). */
export function useSeekerContactNotice(enabled = true): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    cached ??= getSeekerContactNoticeAction();
    let alive = true;
    void cached.then((v) => alive && setShow(v));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return show;
}
