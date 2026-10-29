"use client";

import { useState } from "react";
import type { FeaturedUpsellSettingsDto } from "@bhavano/types/featuredUpsell";
import { updateFeaturedUpsellSettingsAction } from "@/app/actions/admin";

const cardStyle = { border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" } as const;
const inputStyle = { border: "1px solid var(--border)", borderRadius: 9, padding: "9px 10px", fontSize: 13.5, background: "var(--surface)", color: "var(--text)", width: 110 } as const;

export function FeaturedUpsellSettingsForm({ initial }: { initial: FeaturedUpsellSettingsDto }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [card, setCard] = useState(initial.listingCardEnabled);
  const [minAge, setMinAge] = useState(String(initial.minAgeHours));
  const [quiet, setQuiet] = useState(String(initial.quietDays));
  const [maxShows, setMaxShows] = useState(String(initial.maxShowsPerAd));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const nums = { minAgeHours: Number(minAge), quietDays: Number(quiet), maxShowsPerAd: Number(maxShows) };
  const valid =
    Number.isInteger(nums.minAgeHours) && nums.minAgeHours >= 0 && nums.minAgeHours <= 720 &&
    Number.isInteger(nums.quietDays) && nums.quietDays >= 0 && nums.quietDays <= 90 &&
    Number.isInteger(nums.maxShowsPerAd) && nums.maxShowsPerAd >= 1 && nums.maxShowsPerAd <= 20;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateFeaturedUpsellSettingsAction({ enabled, listingCardEnabled: card, ...nums });
    setSaving(false);
    setMessage(result.success ? { type: "success", text: "Saved. Owners see it from their next visit." } : { type: "error", text: result.error });
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} inputMode="numeric" style={inputStyle} />
    </label>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Show the &ldquo;Make your ad Featured&rdquo; dialog on My listings</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", maxWidth: 640 }}>
              Once per browser session, for the owner&rsquo;s newest live ad that is not Featured. It shows the ad&rsquo;s own views, saves and interested people, and the real Featured benefits.
            </span>
          </span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={card} onChange={(e) => setCard(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Show a slim card on the owner&rsquo;s own listing page</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", maxWidth: 640 }}>
              A small card at the top, only for the ad&rsquo;s owner. Never a dialog there: that page is also a search page.
            </span>
          </span>
        </label>
      </div>
      <div style={{ ...cardStyle, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {field("Leave a new ad alone for (hours)", minAge, setMinAge)}
        {field("Quiet after 'Not now' (days)", quiet, setQuiet)}
        {field("Most times one ad is offered", maxShows, setMaxShows)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving || !valid}
          style={{ background: "var(--green)", color: "var(--on-green)", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: saving || !valid ? "default" : "pointer", opacity: saving || !valid ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {!valid && <span style={{ fontSize: 13, color: "var(--danger)" }}>Use whole numbers within range.</span>}
        {message && <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>{message.text}</span>}
      </div>
    </div>
  );
}
