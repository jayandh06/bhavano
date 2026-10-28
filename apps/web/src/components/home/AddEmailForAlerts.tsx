"use client";

import { useState } from "react";
import { requestEmailCodeAction, verifyEmailAction } from "@/app/actions/users";

/** Adds a verified email without leaving the page: the free way to be alerted for someone who signed in with a mobile number only. Same two steps and the same
 * server checks as the profile's email link (an address only reaches the account once the 6-digit code is confirmed). If the address already belongs to another
 * Bhavano account, linking them needs the approval step on the Profile page, so this points there instead of merging anything itself. */
export function AddEmailForAlerts({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setPending(true);
    setError(null);
    const res = await requestEmailCodeAction(email.trim());
    setPending(false);
    if (res.success) setPhase("code");
    else setError(res.error ?? "Couldn't send the code");
  }

  async function verify() {
    setPending(true);
    setError(null);
    const res = await verifyEmailAction(email.trim(), code.trim());
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    if (res.result.status === "linked") {
      onAdded();
      return;
    }
    setError("This email is already on another Bhavano account. Open your profile and add it there to link the two accounts.");
  }

  const inputClass = "border border-border rounded-lg px-3 py-2 text-[13px] bg-surface text-text w-full sm:w-64";
  const buttonClass = "rounded-lg bg-green px-3.5 py-2 text-[13px] font-bold text-on-green cursor-pointer disabled:opacity-60";

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-alt/60 p-3">
      <p className="m-0 mb-2 text-[13px] font-bold text-text">Add your email to get free alerts</p>
      {phase === "email" ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          <button type="button" className={buttonClass} disabled={pending || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void sendCode()}>
            {pending ? "Sending…" : "Send code"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          <button type="button" className={buttonClass} disabled={pending || code.trim().length !== 6} onClick={() => void verify()}>
            {pending ? "Checking…" : "Verify"}
          </button>
          <button type="button" className="text-[12px] text-muted bg-transparent border-0 cursor-pointer underline" onClick={() => setPhase("email")}>
            Change email
          </button>
        </div>
      )}
      {error && <p className="m-0 mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
