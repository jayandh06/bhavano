"use client";

import { useState } from "react";
import type { PostFormSettings } from "@/lib/bff";
import { updatePostFormSettingsAction } from "@/app/actions/admin";

/** Mirrors UpdatePostFormSettingsDto's bounds, so an out-of-range value is caught here rather than as a 400 from the BFF. */
const MIN = 0;
const MAX = 100;
const PRESETS = [0, 10, 25, 50, 100];

export function PostFormSettingsForm({ initial }: { initial: PostFormSettings }) {
  const [value, setValue] = useState(String(initial.v2Percent));
  const [saved, setSaved] = useState(initial.v2Percent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = Number(value);
  const valid = value !== "" && Number.isInteger(parsed) && parsed >= MIN && parsed <= MAX;
  const changed = valid && parsed !== saved;

  async function onSave() {
    if (!valid) return;
    setSaving(true);
    setMessage(null);
    const result = await updatePostFormSettingsAction({ v2Percent: parsed });
    setSaving(false);
    if (result.success) {
      setSaved(parsed);
      setMessage({
        type: "success",
        text: `Saved. ${parsed}% of visitors will get the redesigned form. The website picks the change up within about 30 seconds.`,
      });
    } else {
      setMessage({ type: "error", text: result.error });
    }
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
        <div style={{ fontWeight: 700, fontSize: 14 }}>Share of visitors who get the redesigned form</div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
              Percent of visitors (0 to 100)
            </label>
            <input
              type="number"
              min={MIN}
              max={MAX}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setValue(String(p))}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: parsed === p ? "var(--green)" : "var(--surface)",
                  color: parsed === p ? "var(--on-green)" : "var(--text)",
                }}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
          Now live: <strong style={{ color: "var(--text)" }}>{saved}%</strong>. 0 shows the original form to everyone; 100 shows the new form to
          everyone. Changing it moves visitors between groups only as the share grows or shrinks, since each visitor has a fixed place in the
          0&ndash;99 range.
        </p>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
          To compare the two forms, open the{" "}
          <a href="/post-funnel?country=india" style={{ color: "var(--green)", fontWeight: 700 }}>
            Post-ad funnel
          </a>{" "}
          with Country set to India and use <em>Form version</em>. Only sessions from after the redesign went live carry a version.
        </p>
      </div>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)", margin: 0 }}>{message.text}</p>
      )}

      <button
        onClick={onSave}
        disabled={saving || !changed}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: "none",
          borderRadius: 8,
          padding: 13,
          fontSize: 14,
          fontWeight: 700,
          cursor: saving || !changed ? "default" : "pointer",
          opacity: saving || !changed ? 0.6 : 1,
        }}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
