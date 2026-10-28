"use client";

import { useEffect, useState } from "react";
import type { EmailLoginMode } from "@bhavano/types/loginSettings";
import { getLoginMethodsAction } from "@/app/actions/auth";

let cached: Promise<EmailLoginMode> | null = null;

/** Whether the login screens may offer Google (set in Admin -> Settings -> Login methods). Starts as "all" so nothing flickers away on a normal site, and falls
 * back to it if the lookup fails; the server enforces the setting regardless, this only decides what is shown. One lookup per page load, shared by every user of it, and only made once `enabled` (the login dialog is open) so ordinary page views cost nothing extra. */
export function useEmailLoginMode(enabled = true): EmailLoginMode {
  const [mode, setMode] = useState<EmailLoginMode>("all");
  useEffect(() => {
    if (!enabled) return;
    cached ??= getLoginMethodsAction();
    let alive = true;
    void cached.then((m) => alive && setMode(m));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return mode;
}
