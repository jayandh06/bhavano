"use client";

import { useState } from "react";
import type { OwnerAlertSettingsDto } from "@bhavano/types/ownerAlerts";
import { updateOwnerAlertSettingsAction } from "@/app/actions/admin";

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" } as const;

/** Whether the paid owner-alert channels also go to ads that are not Featured. Both off means Featured ads only. */
export function OwnerAlertSettingsForm({ initial }: { initial: OwnerAlertSettingsDto }) {
  const [whatsapp, setWhatsapp] = useState(initial.whatsappForFreeAds);
  const [sms, setSms] = useState(initial.smsForFreeAds);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const unchanged = whatsapp === saved.whatsappForFreeAds && sms === saved.smsForFreeAds;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateOwnerAlertSettingsAction({ whatsappForFreeAds: whatsapp, smsForFreeAds: sms });
    setSaving(false);
    if (result.success) {
      setSaved({ whatsappForFreeAds: whatsapp, smsForFreeAds: sms });
      setMessage({ type: "success", text: "Saved. It applies to the next alert." });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  const row = (checked: boolean, set: (v: boolean) => void, title: string, body: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "8px 0" }}>
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 2, maxWidth: 640 }}>{body}</span>
      </span>
    </label>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Paid alert channels for ads that are not Featured</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px", maxWidth: 680 }}>
          App notifications and email are always free for every ad. WhatsApp and SMS cost per message, so by default they go to Featured ads only. Turning one on here sends it
          for every ad when someone <strong>messages the owner</strong> or <strong>reveals their number</strong>, on whichever channel the owner ranked first that can reach them.
          Plain &ldquo;viewed your ad&rdquo; alerts stay Featured-only, because they are frequent.
        </p>
        {row(whatsapp, setWhatsapp, "Send WhatsApp alerts for all ads", "Needs the approved WhatsApp templates. A WhatsApp utility message costs roughly 30 to 50 paise.")}
        {row(sms, setSms, "Send SMS alerts for all ads", "Needs the registered SMS templates. SMS costs more per message than WhatsApp.")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving || unchanged}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: saving || unchanged ? "default" : "pointer",
            opacity: saving || unchanged ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message && <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</span>}
      </div>
    </div>
  );
}
