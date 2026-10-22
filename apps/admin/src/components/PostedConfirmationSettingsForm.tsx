"use client";

import { useState } from "react";
import type { PostedConfirmationSettingsDto } from "@bhavano/types";
import { updatePostedConfirmationSettingsAction } from "@/app/actions/admin";

const MAX_MINUTES = 1440;

export function PostedConfirmationSettingsForm({ initial }: { initial: PostedConfirmationSettingsDto }) {
  const [delayMinutes, setDelayMinutes] = useState(String(initial.delayMinutes));
  const [holdAdLive, setHoldAdLive] = useState(initial.holdAdLive);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = Number(delayMinutes);
  const valid = delayMinutes.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_MINUTES;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updatePostedConfirmationSettingsAction({ delayMinutes: parsed, holdAdLive });
    setSaving(false);
    setMessage(
      result.success
        ? { type: "success", text: "Saved. It applies to ads posted from now on." }
        : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Wait before sending</div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 320 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Minutes after posting (0 to {MAX_MINUTES})</span>
          <input
            type="number"
            min={0}
            max={MAX_MINUTES}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(e.target.value)}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 9,
              padding: "9px 10px",
              fontSize: 13.5,
              background: "var(--surface)",
              color: "var(--text)",
            }}
          />
        </label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 0", maxWidth: 560 }}>
          Set <strong>0</strong> to send it the moment the ad is posted, before the Featured offer. The
          check runs every 5 minutes, so a message can go out up to 5 minutes after this. Only the
          website and the latest app hold the message back; older app versions still send it at post
          time.
        </p>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Keep the ad off the site until then</div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={holdAdLive}
            onChange={(e) => setHoldAdLive(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>
              Don&rsquo;t show a free ad to buyers until the wait above has passed
            </span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2, maxWidth: 560 }}>
              Instead of going live the moment it is posted, a free ad goes live after the same number of
              minutes, and the &ldquo;your ad is posted&rdquo; message goes out then. The seller sees
              &ldquo;Going live at …&rdquo;. Paying for Featured puts the ad live at once, and you can
              publish one early from its admin page. Ads that need a posting fee, admin-assisted ads and
              bulk imports are not held. Off by default. Needs the latest website and app to show the
              wording; older apps just see the ad as not live yet.
            </span>
          </span>
        </label>
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
        {message && (
          <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
