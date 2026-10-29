"use client";

import { useState } from "react";
import type { SeekerContactConsentMode, SeekerContactSettingsDto } from "@bhavano/types/seekerContact";
import { updateSeekerContactSettingsAction } from "@/app/actions/admin";

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" } as const;
const inputStyle = { border: "1px solid var(--border)", borderRadius: 9, padding: "9px 10px", fontSize: 13.5, background: "var(--surface)", color: "var(--text)", width: 110 } as const;

export function SeekerContactSettingsForm({ initial }: { initial: SeekerContactSettingsDto }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [mode, setMode] = useState<SeekerContactConsentMode>(initial.consentMode);
  const [free, setFree] = useState(String(initial.freeLeadRevealsPerOwner));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const freeNum = Number(free);
  const valid = Number.isInteger(freeNum) && freeNum >= 0 && freeNum <= 50;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateSeekerContactSettingsAction({ enabled, consentMode: mode, freeLeadRevealsPerOwner: freeNum });
    setSaving(false);
    setMessage(result.success ? { type: "success", text: "Saved. Owners see it from their next visit." } : { type: "error", text: result.error });
  }

  const radio = (value: SeekerContactConsentMode, title: string, body: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", maxWidth: 640 }}>{body}</span>
      </span>
    </label>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Show interested people&rsquo;s phone numbers to ad owners</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", maxWidth: 640 }}>
              Only a verified number, only for interest in the last 30 days, never for admins. Off: owners see names only, as today.
            </span>
          </span>
        </label>
      </div>
      <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 700 }}>Who is shareable</div>
        {radio("notice", "Notice only", "Everyone with a verified phone, unless they turn it off under Profile. The notice is shown on the listing page.")}
        {radio("opt_in", "Opt-in", "Only people who tick the box. Switching to this hides everyone who has not ticked, immediately.")}
      </div>
      <div style={{ ...cardStyle, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Free lead unlocks per new owner (then credits)</span>
          <input value={free} onChange={(e) => setFree(e.target.value)} inputMode="numeric" style={inputStyle} />
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving || !valid}
          style={{ background: "var(--green)", color: "var(--on-green)", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: saving || !valid ? "default" : "pointer", opacity: saving || !valid ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {!valid && <span style={{ fontSize: 13, color: "var(--danger)" }}>Use a whole number from 0 to 50.</span>}
        {message && <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</span>}
      </div>
    </div>
  );
}
