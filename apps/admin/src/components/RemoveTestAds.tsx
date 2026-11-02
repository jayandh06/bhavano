"use client";

import { useState } from "react";
import { deleteTestAdsAction } from "@/app/actions/admin";

/** Shown on the Listings screen only while test ads exist: the ads made from the /post admin test scenarios (title starts with
 * "[TEST]" and the owner is an admin). One confirmed click hard-deletes them all, with the same asset cleanup as deleting a single
 * listing. See docs/plans/post-ad-test-scenarios.md. */
export function RemoveTestAds({ count }: { count: number }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function onRemove() {
    const ok = window.confirm(
      `Permanently delete ${count} test ad${count === 1 ? "" : "s"}? Only admin-owned ads whose title starts with "[TEST]" are removed. This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    const result = await deleteTestAdsAction();
    setBusy(false);
    if (!result.success) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    const failed = result.failed ?? 0;
    setMessage({
      type: failed > 0 ? "error" : "success",
      text: `Removed ${result.deleted ?? 0} test ad${result.deleted === 1 ? "" : "s"}${failed > 0 ? `; ${failed} could not be removed (see the server log)` : ""}.`,
    });
  }

  if (count === 0 && !message) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        margin: "0 0 16px",
        padding: "10px 14px",
        border: "1px dashed var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
        fontSize: 13,
      }}
    >
      <span>
        <strong>{count}</strong> test ad{count === 1 ? "" : "s"} from the Post ad test scenarios (title starts with [TEST]).
      </span>
      {count > 0 && (
        <button
          onClick={onRemove}
          disabled={busy}
          style={{
            background: "transparent",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 13,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Removing…" : "Remove test ads"}
        </button>
      )}
      {message && <span style={{ color: message.type === "success" ? "var(--green)" : "var(--danger)", fontWeight: 700 }}>{message.text}</span>}
    </div>
  );
}
