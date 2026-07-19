"use client";

import { useAuthGate } from "./AuthGateProvider";

export function RequireLoginPrompt({ message }: { message: string }) {
  const { requireLogin } = useAuthGate();

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
