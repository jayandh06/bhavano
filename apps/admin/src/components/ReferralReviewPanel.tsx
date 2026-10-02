"use client";

import { useState } from "react";
import type { ReferralStatus } from "@bhavano/types";
import {
  approveReferralAction,
  freezeReferralsAction,
  reverseReferralAction,
  unfreezeReferralsAction,
} from "@/app/actions/referrals";
import type { ActionResult } from "@/app/actions/users";

type Kind = "approve" | "reverse" | "freeze" | "unfreeze";

/** Review actions on /referrals/[id]. Reverse and freeze require a reason — it goes into the
 * referral audit log shown below the panel. */
export function ReferralReviewPanel({
  referralId,
  status,
  referrerId,
  referrerFrozen,
  creditUnused,
}: {
  referralId: string;
  status: ReferralStatus;
  referrerId: string;
  referrerFrozen: boolean;
  creditUnused: boolean;
}) {
  const [pending, setPending] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: Kind, action: () => Promise<ActionResult>) {
    setPending(kind);
    setError(null);
    const result = await action();
    setPending(null);
    if (!result.success) setError(result.error);
  }

  function askReason(message: string): string | null {
    const reason = window.prompt(message)?.trim();
    if (!reason) return null;
    if (reason.length < 3) {
      setError("Please give a reason of at least 3 characters.");
      return null;
    }
    return reason;
  }

  function onApprove() {
    const note = window.prompt("Clear the same-device flag? Optional note for the audit log:");
    if (note === null) return;
    void run("approve", () => approveReferralAction(referralId, note.trim()));
  }

  function onReverse() {
    const credit = creditUnused ? " The unused boost credit will be revoked." : "";
    const reason = askReason(`Reverse this referral?${credit} Reason (required):`);
    if (reason) void run("reverse", () => reverseReferralAction(referralId, reason));
  }

  function onFreeze() {
    const reason = askReason(
      "Freeze this referrer? They stop earning new referral credits; credits they already have stay usable. Reason (required):",
    );
    if (reason) void run("freeze", () => freezeReferralsAction(referrerId, reason, referralId));
  }

  function onUnfreeze() {
    const note = window.prompt("Unfreeze this referrer? Optional note for the audit log:");
    if (note === null) return;
    void run("unfreeze", () => unfreezeReferralsAction(referrerId, note.trim(), referralId));
  }

  const busy = pending !== null;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "var(--surface)", marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {status === "blocked" && (
          <button onClick={onApprove} disabled={busy} style={buttonStyle(busy)}>
            {pending === "approve" ? "Approving…" : "Clear flag"}
          </button>
        )}
        {status !== "reversed" && (
          <button onClick={onReverse} disabled={busy} style={buttonStyle(busy, true)}>
            {pending === "reverse" ? "Reversing…" : "Reverse referral"}
          </button>
        )}
        {referrerFrozen ? (
          <button onClick={onUnfreeze} disabled={busy} style={buttonStyle(busy)}>
            {pending === "unfreeze" ? "Saving…" : "Unfreeze referrer"}
          </button>
        ) : (
          <button onClick={onFreeze} disabled={busy} style={buttonStyle(busy, true)}>
            {pending === "freeze" ? "Saving…" : "Freeze referrer"}
          </button>
        )}
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}

const buttonStyle = (disabled: boolean, danger = false): React.CSSProperties => ({
  background: "var(--surface)",
  color: danger ? "var(--danger)" : "var(--text)",
  border: `1.5px solid ${danger ? "var(--danger)" : "var(--border)"}`,
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
});
