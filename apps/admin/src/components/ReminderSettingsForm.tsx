"use client";

import { useState } from "react";
import type { ReminderSettingsDto } from "@bhavano/types";
import { updateReminderSettingsAction } from "@/app/actions/admin";

const MAX_EXPIRY_DAYS = 14;
const MAX_EXPIRY_STAGES = 4;
const MAX_FOLLOWUP_HOURS = 720;
const MAX_FOLLOWUP_STAGES = 5;

/** "3, 1" to [3, 1]; null when anything is not a whole number in range, or there are too many or none. */
function parseList(text: string, max: number, maxCount: number): number[] | null {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > maxCount) return null;
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > max)) return null;
  return [...new Set(numbers)];
}

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" } as const;
const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "9px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  maxWidth: 320,
} as const;

export function ReminderSettingsForm({ initial }: { initial: ReminderSettingsDto }) {
  const [expiryEnabled, setExpiryEnabled] = useState(initial.featuredExpiryEnabled);
  const [expiryDays, setExpiryDays] = useState(initial.featuredExpiryDays.join(", "));
  const [followupEnabled, setFollowupEnabled] = useState(initial.followupEnabled);
  const [followupHours, setFollowupHours] = useState(initial.followupHours.join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const days = parseList(expiryDays, MAX_EXPIRY_DAYS, MAX_EXPIRY_STAGES);
  const hours = parseList(followupHours, MAX_FOLLOWUP_HOURS, MAX_FOLLOWUP_STAGES);
  const valid = days !== null && hours !== null;

  async function onSave() {
    if (!days || !hours) return;
    setSaving(true);
    setMessage(null);
    const result = await updateReminderSettingsAction({
      featuredExpiryEnabled: expiryEnabled,
      featuredExpiryDays: days,
      followupEnabled,
      followupHours: hours,
    });
    setSaving(false);
    setMessage(
      result.success
        ? { type: "success", text: "Saved. The next run of each reminder uses these values." }
        : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Nudge a new ad to go Featured</div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={followupEnabled} onChange={(e) => setFollowupEnabled(e.target.checked)} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>Send these automatically</span>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Hours after the ad goes live, separated by commas (1 to {MAX_FOLLOWUP_STAGES} values, each 1 to {MAX_FOLLOWUP_HOURS})
          </span>
          <input value={followupHours} onChange={(e) => setFollowupHours(e.target.value)} style={inputStyle} />
        </label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 0", maxWidth: 600 }}>
          Default <strong>4, 24, 72</strong>: 4 hours, 1 day and 3 days after posting. Only ads that are live and not Featured get it, once per time, at most one
          message per owner per run and 40 per hour, between 9 am and 8 pm IST (a time that falls overnight goes out the next morning). Two messages for the same ad
          are never closer than 12 hours.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Warn before a Featured period ends</div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={expiryEnabled} onChange={(e) => setExpiryEnabled(e.target.checked)} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>Send these automatically</span>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Days before the end, separated by commas (1 to {MAX_EXPIRY_STAGES} values, each 1 to {MAX_EXPIRY_DAYS})
          </span>
          <input value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} style={inputStyle} />
        </label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 0", maxWidth: 600 }}>
          Default <strong>3, 1</strong>: 3 days and 1 day before. Checked once a day at 10 am IST; each reminder goes out once per Feature period, and a Feature
          period no longer than the number of days skips that reminder. The message has a Renew Feature button, and renewing adds to the days still left.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving || !valid}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: saving || !valid ? "default" : "pointer",
            opacity: saving || !valid ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {!valid && <span style={{ fontSize: 13, color: "var(--danger)" }}>Use whole numbers separated by commas, within the ranges above.</span>}
        {message && (
          <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
