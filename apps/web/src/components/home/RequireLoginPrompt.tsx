"use client";

import { useAuthGate } from "./AuthGateProvider";

export function RequireLoginPrompt({
  message,
  redirectTo,
}: {
  message: string;
  /** Where to land after logging in. Worth setting wherever the page cannot be used logged out,
   * so the login finishes the errand rather than abandoning it. */
  redirectTo?: string;
}) {
  const { requireLogin } = useAuthGate();

  return (
    <div className="text-center px-5 py-[60px]">
      <p className="text-sm text-text-soft mb-4">{message}</p>
      <button
        onClick={() => requireLogin({ redirectTo })}
        className="bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold cursor-pointer"
      >
        Log in
      </button>
    </div>
  );
}
