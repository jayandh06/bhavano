"use client";

import { useState } from "react";
import type { ReferralSettingsDto } from "@bhavano/types";
import { updateReferralSettingsAction } from "@/app/actions/referrals";

type NumericKey = Exclude<keyof ReferralSettingsDto, "welcomeRewardEnabled">;

const NUMERIC_FIELDS: { key: NumericKey; label: string; min: number; max?: number }[] = [
  { key: "boostDays", label: "Feature length (days)", min: 1, max: 30 },
  { key: "creditExpiryDays", label: "Credit expires after (days)", min: 1, max: 365 },
  { key: "monthlyCapPerReferrer", label: "Credits per referrer per month", min: 0, max: 100 },
  { key: "bonusExtraBoostAtReferrals", label: "Bonus Feature at N referrals / month", min: 1 },
  { key: "topAgentBadgeAtReferrals", label: "Top agent badge at N referrals / month", min: 1 },
  { key: "attributionWindowDays", label: "Attribution window (days)", min: 1, max: 365 },
  { key: "takedownRevocationWindowDays", label: "Revoke if referred ad removed within (days)", min: 0, max: 365 },
  { key: "welcomeRewardFeaturedDays", label: "Welcome reward: featured days", min: 1, max: 30 },
];

const GROUPS: { title: string; keys: NumericKey[] }[] = [
  { title: "Reward", keys: ["boostDays", "creditExpiryDays"] },
  { title: "Limits", keys: ["monthlyCapPerReferrer", "attributionWindowDays", "takedownRevocationWindowDays"] },
  { title: "Bonus tiers", keys: ["bonusExtraBoostAtReferrals", "topAgentBadgeAtReferrals"] },
];

export function ReferralSettingsForm({ initial }: { initial: ReferralSettingsDto }) {
  const [values, setValues] = useState<Record<NumericKey, string>>(
    () =>
      Object.fromEntries(NUMERIC_FIELDS.map((f) => [f.key, String(initial[f.key])])) as Record<NumericKey, string>,
  );
  const [welcomeRewardEnabled, setWelcomeRewardEnabled] = useState(initial.welcomeRewardEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = {
    ...(Object.fromEntries(NUMERIC_FIELDS.map((f) => [f.key, Number(values[f.key])])) as Record<NumericKey, number>),
    welcomeRewardEnabled,
  };
  const valid = NUMERIC_FIELDS.every((f) => {
    const n = parsed[f.key];
    return values[f.key] !== "" && Number.isInteger(n) && n >= f.min && (f.max === undefined || n <= f.max);
  });

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateReferralSettingsAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Referral settings updated." } : { type: "error", text: result.error },
    );
  }

  const field = (key: NumericKey) => {
    const f = NUMERIC_FIELDS.find((x) => x.key === key)!;
    return (
      <Field
        key={key}
        label={f.label}
        value={values[key]}
        min={f.min}
        max={f.max}
        onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
      />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {GROUPS.map((group) => (
        <div
          key={group.title}
          style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{group.title}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{group.keys.map(field)}</div>
        </div>
      ))}

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Welcome reward for the referred user</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={welcomeRewardEnabled}
            onChange={(e) => setWelcomeRewardEnabled(e.target.checked)}
          />
          Give the new user a free featured day on their first approved ad
        </label>
        <div style={{ display: "flex", gap: 12 }}>{field("welcomeRewardFeaturedDays")}</div>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
        Changes apply to credits granted from now on. A credit already granted keeps the Feature length
        and expiry it was given.
      </p>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)", margin: 0 }}>
          {message.text}
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

function Field({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max?: number;
}) {
  return (
    <div style={{ flex: "1 1 200px" }}>
      <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        style={{
          width: "100%",
          border: "1px solid var(--border)",
          borderRadius: 9,
          padding: "10px 12px",
          fontSize: 14,
          outline: "none",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      />
    </div>
  );
}
