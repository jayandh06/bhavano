"use client";

import { useState } from "react";
import { isValidAppVersion, type AppVersionSettingsDto } from "@bhavano/types/appVersion";
import { updateAppVersionSettingsAction } from "@/app/actions/admin";

const inputStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
} as const;

const labelStyle = { display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 } as const;

/** Empty is allowed (no minimum); anything else must look like 1.2.0. Mirrors the BFF's check. */
const ok = (v: string) => v === "" || isValidAppVersion(v);

export function AppVersionSettingsForm({ initial }: { initial: AppVersionSettingsDto }) {
  const [android, setAndroid] = useState(initial.androidMinVersion);
  const [ios, setIos] = useState(initial.iosMinVersion);
  const [message, setMessage] = useState(initial.message);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const valid = ok(android.trim()) && ok(ios.trim());

  async function onSave() {
    setSaving(true);
    setResult(null);
    const res = await updateAppVersionSettingsAction({
      androidMinVersion: android.trim(),
      iosMinVersion: ios.trim(),
      message: message.trim(),
    });
    setSaving(false);
    setResult(res.success ? { type: "success", text: "Saved. Phones pick it up within a minute." } : { type: "error", text: res.error });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Android: lowest allowed version</label>
            <input value={android} onChange={(e) => setAndroid(e.target.value)} placeholder="e.g. 1.2.0" style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>iPhone: lowest allowed version</label>
            <input value={ios} onChange={(e) => setIos(e.target.value)} placeholder="e.g. 1.2.0" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Message on the update screen (optional, up to 200 characters)</label>
          <input
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A new version with important fixes is available."
            style={inputStyle}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Only app versions that already contain this feature (1.2.0 and newer) can show the update screen. Older
          installs ignore this setting. Set a minimum only after the new version is live in the store, or people will
          be told to update to something they can&rsquo;t download yet.
        </p>
      </div>

      {!valid && (
        <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>Use a version like 1.2.0, or leave it empty.</p>
      )}
      {result && (
        <p style={{ fontSize: 13, color: result.type === "success" ? "var(--green)" : "var(--danger)", margin: 0 }}>
          {result.text}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving || !valid}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: "none",
          borderRadius: 8,
          padding: 13,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          opacity: saving || !valid ? 0.6 : 1,
        }}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
