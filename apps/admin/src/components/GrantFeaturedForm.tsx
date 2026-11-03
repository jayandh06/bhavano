"use client";

import { useState } from "react";
import { grantFeaturedAction } from "@/app/actions/admin";

const DAY_OPTIONS = [7, 15, 30] as const;

/** Gives this ad free Featured days: a paid-at-zero Payment, the Featured period and Instant Alerts, tagged `admin_grant:<reason>` on the
 * Payments screen. Used for the PG and coworking operator pilot (docs/plans/pg-coworking-pilot-kit.md). It adds to a Feature period that is
 * still running. Only a live ad that has been claimed (not owned by the Bulk Import account) can take it. */
export function GrantFeaturedForm({ listingId, boostedUntil, expiresAt }: { listingId: string; boostedUntil: string | null; expiresAt: string }) {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [reason, setReason] = useState("pilot_operator");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const reasonValid = /^[a-z0-9_]{1,40}$/.test(reason);
  const featuredNow = boostedUntil && new Date(boostedUntil) > new Date();

  async function onGrant() {
    if (!window.confirm(`Give this ad ${days} free Featured days (${reason})?`)) return;
    setBusy(true);
    setMessage(null);
    const result = await grantFeaturedAction(listingId, days, reason);
    setBusy(false);
    if (!result.success) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    const featuredUntil = new Date(result.boostedUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const lapses = new Date(result.listingExpiresAt) < new Date(result.boostedUntil);
    setMessage({
      type: "success",
      text: `Featured until ${featuredUntil}.${lapses ? ` The ad itself expires on ${new Date(result.listingExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, so alerts stop then unless it is renewed.` : ""}`,
    });
  }

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginTop: 20, background: "var(--surface)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Grant free Featured</div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", maxWidth: 640 }}>
        {featuredNow ? `Featured now until ${new Date(boostedUntil!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}; days are added after that. ` : "Not Featured now. "}
        Ad expires {new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Shows on Payments as an admin grant, amount 0.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
          Days
          <select value={days} onChange={(e) => setDays(Number(e.target.value) as (typeof DAY_OPTIONS)[number])} style={inputStyle}>
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
          Reason code
          <input value={reason} onChange={(e) => setReason(e.target.value.toLowerCase())} style={{ ...inputStyle, width: 190 }} />
        </label>
        <button
          onClick={onGrant}
          disabled={busy || !reasonValid}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: busy || !reasonValid ? "default" : "pointer",
            opacity: busy || !reasonValid ? 0.6 : 1,
          }}
        >
          {busy ? "Granting…" : "Grant Featured"}
        </button>
      </div>
      {message && <p style={{ fontSize: 13, margin: "10px 0 0", fontWeight: 700, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</p>}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
};
