"use client";

import { useState } from "react";
import type { EmailLoginMode, LoginSettingsDto } from "@bhavano/types/loginSettings";
import { updateLoginSettingsAction } from "@/app/actions/admin";

const OPTIONS: { value: EmailLoginMode; title: string; body: string }[] = [
  {
    value: "all",
    title: "Allowed for everyone",
    body: "Google and Apple sign-in work as they always have. Anyone can create an account with a new email address.",
  },
  {
    value: "existing_only",
    title: "Existing accounts only",
    body:
      "People who already have a Bhavano account can still sign in with Google or Apple, but a new account can only be created with a mobile number (OTP). " +
      "This stops throwaway email accounts without locking out genuine returning users.",
  },
  {
    value: "off",
    title: "Off: mobile number only",
    body:
      "Google and Apple sign-in are closed, and the buttons are hidden. People who signed up only with an email address will not be able to log in until you reopen it. " +
      "Staff (your ADMIN_EMAILS) can always sign in, so you cannot lock yourself out.",
  },
];

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" } as const;

export function LoginSettingsForm({ initial }: { initial: LoginSettingsDto }) {
  const [mode, setMode] = useState<EmailLoginMode>(initial.emailLogin);
  const [saved, setSaved] = useState<EmailLoginMode>(initial.emailLogin);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateLoginSettingsAction({ emailLogin: mode });
    setSaving(false);
    if (result.success) {
      setSaved(mode);
      setMessage({ type: "success", text: "Saved. The website and app pick this up within a minute; the sign-in checks apply straight away." });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Sign in with Google or Apple (email)</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>Mobile number sign-in (OTP) is always available.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} role="radiogroup">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                cursor: "pointer",
                border: `1.5px solid ${mode === o.value ? "var(--green)" : "var(--border)"}`,
                borderRadius: 9,
                padding: "10px 12px",
              }}
            >
              <input type="radio" name="email-login" checked={mode === o.value} onChange={() => setMode(o.value)} style={{ marginTop: 3 }} />
              <span>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{o.title}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 2, maxWidth: 640 }}>{o.body}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving || mode === saved}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: saving || mode === saved ? "default" : "pointer",
            opacity: saving || mode === saved ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message && (
          <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
