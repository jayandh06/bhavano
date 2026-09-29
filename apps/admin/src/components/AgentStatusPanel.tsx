"use client";

import { useState } from "react";
import { grantFoundingBrokerProAction, setReraVerifiedAction } from "@/app/actions/users";
import { formatDate } from "@/lib/formatDateTime";

const FOUNDING_BROKER_MONTHS = 3;

/** Agent-only controls on the admin user page: the founding-broker Agent Pro grant and the
 * RERA-verified mark (which the BFF clears again whenever the agent edits their RERA number). */
export function AgentStatusPanel({
  userId,
  isAgent,
  reraNumber,
  reraVerifiedAt,
  agentProUntil,
  proActive,
}: {
  userId: string;
  isAgent: boolean;
  reraNumber: string | null;
  reraVerifiedAt: string | null;
  agentProUntil: string | null;
  proActive: boolean;
}) {
  const [pending, setPending] = useState<"grant" | "rera" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "grant" | "rera", action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setPending(kind);
    setError(null);
    const result = await action();
    setPending(null);
    if (!result.success) setError(result.error);
  }

  function onGrant() {
    const extra = proActive ? ` on top of the current plan (ends ${formatDate(agentProUntil!)})` : "";
    if (!window.confirm(`Give this user ${FOUNDING_BROKER_MONTHS} months of Agent Pro free${extra}?`)) return;
    void run("grant", () => grantFoundingBrokerProAction(userId, FOUNDING_BROKER_MONTHS));
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "var(--surface)", marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 10 }}>
        Agent Pro: {proActive ? `active until ${formatDate(agentProUntil!)}` : agentProUntil ? `ended ${formatDate(agentProUntil)}` : "never"}
        {" · "}
        RERA: {reraNumber ? `${reraNumber} (${reraVerifiedAt ? `verified ${formatDate(reraVerifiedAt)}` : "not verified"})` : "none on file"}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onGrant} disabled={pending !== null} style={buttonStyle(pending !== null)}>
          {pending === "grant" ? "Granting…" : `Grant founding-broker Pro (${FOUNDING_BROKER_MONTHS} months)`}
        </button>
        {isAgent && reraNumber && (
          <button
            onClick={() => void run("rera", () => setReraVerifiedAction(userId, !reraVerifiedAt))}
            disabled={pending !== null}
            style={buttonStyle(pending !== null)}
          >
            {pending === "rera" ? "Saving…" : reraVerifiedAt ? "Remove RERA verified" : "Mark RERA verified"}
          </button>
        )}
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  background: "var(--surface)",
  color: "var(--text)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
});
