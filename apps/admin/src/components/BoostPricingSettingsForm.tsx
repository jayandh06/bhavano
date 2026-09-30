"use client";

import { useState } from "react";
import { enabledBoostDurations, type BoostPriceSettings } from "@bhavano/types/boostPricing";
import { updateBoostPricingAction } from "@/app/actions/admin";

export function BoostPricingSettingsForm({ initial }: { initial: BoostPriceSettings }) {
  const [propertyBoostPrice7d, setPropertyBoostPrice7d] = useState(String(initial.propertyBoostPrice7d));
  const [propertyBoostPrice15d, setPropertyBoostPrice15d] = useState(String(initial.propertyBoostPrice15d));
  const [propertyBoostPrice30d, setPropertyBoostPrice30d] = useState(String(initial.propertyBoostPrice30d));
  const [coworkingPgStorageBoostPrice7d, setCoworkingPgStorageBoostPrice7d] = useState(
    String(initial.coworkingPgStorageBoostPrice7d),
  );
  const [coworkingPgStorageBoostPrice15d, setCoworkingPgStorageBoostPrice15d] = useState(
    String(initial.coworkingPgStorageBoostPrice15d),
  );
  const [coworkingPgStorageBoostPrice30d, setCoworkingPgStorageBoostPrice30d] = useState(
    String(initial.coworkingPgStorageBoostPrice30d),
  );
  const [furnitureInteriorsBoostPrice7d, setFurnitureInteriorsBoostPrice7d] = useState(
    String(initial.furnitureInteriorsBoostPrice7d),
  );
  const [furnitureInteriorsBoostPrice15d, setFurnitureInteriorsBoostPrice15d] = useState(
    String(initial.furnitureInteriorsBoostPrice15d),
  );
  const [furnitureInteriorsBoostPrice30d, setFurnitureInteriorsBoostPrice30d] = useState(
    String(initial.furnitureInteriorsBoostPrice30d),
  );
  const [showSelectorOnPreview, setShowSelectorOnPreview] = useState(initial.showSelectorOnPreview);
  const [boost7dEnabled, setBoost7dEnabled] = useState(initial.boost7dEnabled);
  const [boost15dEnabled, setBoost15dEnabled] = useState(initial.boost15dEnabled);
  const [boost30dEnabled, setBoost30dEnabled] = useState(initial.boost30dEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const prices = {
    propertyBoostPrice7d: Number(propertyBoostPrice7d),
    propertyBoostPrice15d: Number(propertyBoostPrice15d),
    propertyBoostPrice30d: Number(propertyBoostPrice30d),
    coworkingPgStorageBoostPrice7d: Number(coworkingPgStorageBoostPrice7d),
    coworkingPgStorageBoostPrice15d: Number(coworkingPgStorageBoostPrice15d),
    coworkingPgStorageBoostPrice30d: Number(coworkingPgStorageBoostPrice30d),
    furnitureInteriorsBoostPrice7d: Number(furnitureInteriorsBoostPrice7d),
    furnitureInteriorsBoostPrice15d: Number(furnitureInteriorsBoostPrice15d),
    furnitureInteriorsBoostPrice30d: Number(furnitureInteriorsBoostPrice30d),
  };
  const parsed: BoostPriceSettings = {
    ...prices,
    showSelectorOnPreview,
    boost7dEnabled,
    boost15dEnabled,
    boost30dEnabled,
  };
  const anyDurationOn = enabledBoostDurations(parsed).length > 0;
  // Only the price fields need this check — the toggles are booleans, not positive integers, so
  // they can't be folded into the same Object.values(...).every(...) sweep.
  const valid = Object.values(prices).every((n) => Number.isInteger(n) && n > 0) && anyDurationOn;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateBoostPricingAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Boost prices updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Durations offered in the Boost card</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
          Unchecked durations are hidden from every boost picker (web and app) and can&apos;t be bought.
          An Agent Pro member with an unused free monthly boost still sees the 7-day option.
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <DurationToggle label="7-day boost" checked={boost7dEnabled} onChange={setBoost7dEnabled} />
          <DurationToggle label="15-day boost" checked={boost15dEnabled} onChange={setBoost15dEnabled} />
          <DurationToggle label="30-day boost" checked={boost30dEnabled} onChange={setBoost30dEnabled} />
        </div>
        {!anyDurationOn && (
          <div style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 10 }}>
            Keep at least one duration switched on.
          </div>
        )}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>House / Apartment / Villa / Plot / Commercial</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="7-day boost (₹)" value={propertyBoostPrice7d} onChange={setPropertyBoostPrice7d} />
          <Field label="15-day boost (₹)" value={propertyBoostPrice15d} onChange={setPropertyBoostPrice15d} />
          <Field label="30-day boost (₹)" value={propertyBoostPrice30d} onChange={setPropertyBoostPrice30d} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Coworking / PG / Storage</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="7-day boost (₹)"
            value={coworkingPgStorageBoostPrice7d}
            onChange={setCoworkingPgStorageBoostPrice7d}
          />
          <Field
            label="15-day boost (₹)"
            value={coworkingPgStorageBoostPrice15d}
            onChange={setCoworkingPgStorageBoostPrice15d}
          />
          <Field
            label="30-day boost (₹)"
            value={coworkingPgStorageBoostPrice30d}
            onChange={setCoworkingPgStorageBoostPrice30d}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Furniture / Interiors</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="7-day boost (₹)"
            value={furnitureInteriorsBoostPrice7d}
            onChange={setFurnitureInteriorsBoostPrice7d}
          />
          <Field
            label="15-day boost (₹)"
            value={furnitureInteriorsBoostPrice15d}
            onChange={setFurnitureInteriorsBoostPrice15d}
          />
          <Field
            label="30-day boost (₹)"
            value={furnitureInteriorsBoostPrice30d}
            onChange={setFurnitureInteriorsBoostPrice30d}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showSelectorOnPreview}
            onChange={(e) => setShowSelectorOnPreview(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ fontWeight: 700, fontSize: 14, display: "block" }}>
              Show the Boost selector on the ad Preview step
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              When checked, advertisers pick a plan before posting instead of being offered one
              afterward. The two placements are mutually exclusive — checking this hides the
              post-ad upsell card entirely.
            </span>
          </span>
        </label>
      </div>

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
        {saving ? "Saving…" : "Save boost prices"}
      </button>
    </div>
  );
}

function DurationToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </label>
      <input
        type="number"
        min={1}
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
