"use client";

import { useState, type ReactNode } from "react";
import type { LoginNudgeSettingsDto } from "@bhavano/types";
import { updateLoginNudgeSettingsAction } from "@/app/actions/admin";

type NumberKey =
  | "webPromptAfterDetailViews"
  | "webPromptDelaySeconds"
  | "webPromptRolloutPercent"
  | "appPromptAfterDetailViews"
  | "dismissCooldownDays";

/** Mirrors UpdateLoginNudgeSettingsDto's bounds, so an out-of-range value is caught here rather
 * than as a 400 from the BFF. */
const BOUNDS: Record<NumberKey, [number, number]> = {
  webPromptAfterDetailViews: [2, 50],
  webPromptDelaySeconds: [0, 120],
  webPromptRolloutPercent: [0, 100],
  appPromptAfterDetailViews: [1, 50],
  dismissCooldownDays: [0, 90],
};

export function LoginNudgeSettingsForm({ initial }: { initial: LoginNudgeSettingsDto }) {
  const [flags, setFlags] = useState({
    webOneTapEnabled: initial.webOneTapEnabled,
    webPromptEnabled: initial.webPromptEnabled,
    excludeAdAndSearchLanding: initial.excludeAdAndSearchLanding,
    appPromptEnabled: initial.appPromptEnabled,
  });
  const [numbers, setNumbers] = useState<Record<NumberKey, string>>({
    webPromptAfterDetailViews: String(initial.webPromptAfterDetailViews),
    webPromptDelaySeconds: String(initial.webPromptDelaySeconds),
    webPromptRolloutPercent: String(initial.webPromptRolloutPercent),
    appPromptAfterDetailViews: String(initial.appPromptAfterDetailViews),
    dismissCooldownDays: String(initial.dismissCooldownDays),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = Object.fromEntries(
    (Object.keys(numbers) as NumberKey[]).map((k) => [k, Number(numbers[k])]),
  ) as Record<NumberKey, number>;
  const valid = (Object.keys(BOUNDS) as NumberKey[]).every((k) => {
    const [min, max] = BOUNDS[k];
    return numbers[k] !== "" && Number.isInteger(parsed[k]) && parsed[k] >= min && parsed[k] <= max;
  });

  function setNumber(key: NumberKey) {
    return (v: string) => setNumbers((prev) => ({ ...prev, [key]: v }));
  }
  function setFlag(key: keyof typeof flags) {
    return (v: boolean) => setFlags((prev) => ({ ...prev, [key]: v }));
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateLoginNudgeSettingsAction({ ...flags, ...parsed });
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Login prompt settings updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <Section title="Website: Google one-tap">
        <Toggle
          label="Show Google one-tap on listing pages"
          hint="Google's small corner box: one tap logs in with the Google account already in the browser. It doesn't cover the listing. Needs bhavano.com and www.bhavano.com added as Authorized JavaScript origins on the Google OAuth client first."
          checked={flags.webOneTapEnabled}
          onChange={setFlag("webOneTapEnabled")}
        />
      </Section>

      <Section title="Website: bottom card">
        <Toggle
          label="Show the login card on listing pages"
          hint="A small card at the bottom of the screen with a 'Not now' button."
          checked={flags.webPromptEnabled}
          onChange={setFlag("webPromptEnabled")}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field label="From the Nth listing in a visit (min 2)" value={numbers.webPromptAfterDetailViews} onChange={setNumber("webPromptAfterDetailViews")} bounds={BOUNDS.webPromptAfterDetailViews} />
          <Field label="Delay after the page opens (seconds)" value={numbers.webPromptDelaySeconds} onChange={setNumber("webPromptDelaySeconds")} bounds={BOUNDS.webPromptDelaySeconds} />
          <Field label="Show to this % of visitors" value={numbers.webPromptRolloutPercent} onChange={setNumber("webPromptRolloutPercent")} bounds={BOUNDS.webPromptRolloutPercent} />
        </div>
        <Toggle
          label="Never for visits that started from a Google ad or a search engine"
          hint="Keeps Ads landing-page experience and search rankings safe. Recommended on."
          checked={flags.excludeAdAndSearchLanding}
          onChange={setFlag("excludeAdAndSearchLanding")}
        />
      </Section>

      <Section title="App">
        <Toggle
          label="Show the login sheet with Skip on listing detail"
          hint="Only reaches phones running an app version with this feature."
          checked={flags.appPromptEnabled}
          onChange={setFlag("appPromptEnabled")}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="From the Nth listing opened" value={numbers.appPromptAfterDetailViews} onChange={setNumber("appPromptAfterDetailViews")} bounds={BOUNDS.appPromptAfterDetailViews} />
        </div>
      </Section>

      <Section title="Both">
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Days to stay quiet after 'Not now' / 'Skip'" value={numbers.dismissCooldownDays} onChange={setNumber("dismissCooldownDays")} bounds={BOUNDS.dismissCooldownDays} />
        </div>
      </Section>

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
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
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  bounds,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bounds: [number, number];
}) {
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </label>
      <input
        type="number"
        min={bounds[0]}
        max={bounds[1]}
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
