"use client";

import { useState } from "react";
import type { EmailLoginMode, LoginSettingsDto, PhoneRequirementMode } from "@bhavano/types/loginSettings";
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
    value: "existing_no_phone",
    title: "Move existing accounts to mobile",
    body:
      "Only an existing account that has no mobile number can use Google or Apple, and it must verify a mobile number straight away (it cannot skip, and contact details stay locked until it does). " +
      "Once it has a number, Google and Apple stop working for that account and it signs in with the mobile OTP. New accounts can only use a mobile number.",
  },
  {
    value: "off",
    title: "Off: mobile number only",
    body:
      "Google and Apple sign-in are closed, and the buttons are hidden. People who signed up only with an email address will not be able to log in until you reopen it. " +
      "Staff (your ADMIN_EMAILS) can always sign in, so you cannot lock yourself out.",
  },
];

const PHONE_OPTIONS: { value: PhoneRequirementMode; title: string; body: string }[] = [
  { value: "off", title: "Don't ask", body: "Accounts that signed up with Google or Apple and have no mobile number are left alone." },
  {
    value: "ask",
    title: "Ask them to add a mobile number",
    body: "A skippable \"Add your mobile number\" prompt on the website and app, once a day, for any account without one.",
  },
  {
    value: "required",
    title: "Require a mobile number",
    body:
      "The prompt cannot be skipped (they can only verify a number or log out), and viewing owners' contact details is locked until they do. " +
      "Use this after a couple of weeks of asking; accounts that never add a number stay locked out of contact details.",
  },
];

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" } as const;

export function LoginSettingsForm({ initial }: { initial: LoginSettingsDto }) {
  const [mode, setMode] = useState<EmailLoginMode>(initial.emailLogin);
  const [saved, setSaved] = useState<EmailLoginMode>(initial.emailLogin);
  const [phoneMode, setPhoneMode] = useState<PhoneRequirementMode>(initial.phoneRequirement);
  const [savedPhoneMode, setSavedPhoneMode] = useState<PhoneRequirementMode>(initial.phoneRequirement);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateLoginSettingsAction({ emailLogin: mode, phoneRequirement: phoneMode });
    setSaving(false);
    if (result.success) {
      setSaved(mode);
      setSavedPhoneMode(phoneMode);
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

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Accounts with no mobile number</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>
          For moving people who signed up with Google or Apple to mobile sign-in before you close email sign-in.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} role="radiogroup">
          {PHONE_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                cursor: "pointer",
                border: `1.5px solid ${phoneMode === o.value ? "var(--green)" : "var(--border)"}`,
                borderRadius: 9,
                padding: "10px 12px",
              }}
            >
              <input type="radio" name="phone-requirement" checked={phoneMode === o.value} onChange={() => setPhoneMode(o.value)} style={{ marginTop: 3 }} />
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
          disabled={saving || (mode === saved && phoneMode === savedPhoneMode)}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: saving || (mode === saved && phoneMode === savedPhoneMode) ? "default" : "pointer",
            opacity: saving || (mode === saved && phoneMode === savedPhoneMode) ? 0.6 : 1,
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
