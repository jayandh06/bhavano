"use client";

import { useEffect, useRef } from "react";
import { useAuthGate } from "./AuthGateProvider";

export function RequireLoginPrompt({ message, autoPrompt = false }: { message: string; autoPrompt?: boolean }) {
  const { requireLogin } = useAuthGate();
  const promptedRef = useRef(false);

  /** Opens the login dialog on arrival, for pages whose entire purpose needs an account — /post
   * has nothing to show a logged-out visitor, so making them find and press a button first is a
   * step with no decision in it.
   *
   * Opt-in rather than the default: the other seven callers sit behind a nav click, where a modal
   * appearing unbidden reads as an interruption rather than the next step.
   *
   * The ref is what stops it reopening. `requireLogin` is recreated on every provider render, so
   * this effect re-runs; without the guard, dismissing the dialog would summon it straight back
   * and the button below would be unreachable. */
  useEffect(() => {
    if (!autoPrompt || promptedRef.current) return;
    promptedRef.current = true;
    requireLogin();
  }, [autoPrompt, requireLogin]);

  return (
    <div className="text-center px-5 py-[60px]">
      <p className="text-sm text-text-soft mb-4">{message}</p>
      <button
        onClick={requireLogin}
        className="bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold cursor-pointer"
      >
        Log in
      </button>
    </div>
  );
}
