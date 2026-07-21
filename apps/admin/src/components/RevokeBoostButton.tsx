"use client";

import { useState } from "react";
import { revokeBoostAction } from "@/app/actions/admin";

export function RevokeBoostButton({ listingId }: { listingId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRevoke() {
    setPending(true);
    setError(null);
    const result = await revokeBoostAction(listingId);
    setPending(false);
    if (!result.success) setError(result.error);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
      <button
        onClick={onRevoke}
        disabled={pending}
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--danger)",
          background: "none",
          border: "1px solid var(--danger)",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
