"use client";

import { useState } from "react";
import { optOutContactAction } from "@/app/actions/outreach";

/** Opting out is effectively irreversible from the UI (the suppression entry is what makes it
 * stick across re-imports), so it asks first rather than firing on a single click. */
export function OptOutButton({ contactId }: { contactId: string }) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onOptOut() {
    setPending(true);
    setError(null);
    const result = await optOutContactAction(contactId);
    setPending(false);
    setConfirming(false);
    if (!result.success) setError(result.error);
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--muted)",
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        Opt out
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onOptOut}
          disabled={pending}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#b3413a",
            background: "none",
            border: "1px solid #b3413a",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Opting out…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: "#b3413a" }}>{error}</span>}
    </div>
  );
}
