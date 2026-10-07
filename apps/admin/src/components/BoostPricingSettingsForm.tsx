"use client";

import { useState } from "react";
import {
  enabledBoostDurations,
  DEFAULT_VALUE_BAND_RULES,
  type BoostPriceSettings,
  type BoostPricingRule,
} from "@bhavano/types/boostPricing";
import { updateBoostPricingAction } from "@/app/actions/admin";

/** One label per rule, in the same order as DEFAULT_VALUE_BAND_RULES — purely for display; the
 * rule itself (categories/transactionTypes) is never edited here, only its bands' cutoffs and
 * prices. Matches docs/plans/boost-proof-stat-and-value-bands.md's 6 segments exactly. */
const RULE_LABELS = [
  "Property — sell/buy (by sale price)",
  "Property — rent/lease (by monthly rent)",
  "Furniture/Interiors — sell/buy (by sale price)",
  "Furniture/Interiors — rent/lease (by monthly rent)",
  "PG (by monthly rent)",
  "Coworking (by monthly seat/desk price)",
];

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
  const [allowSkippingBoost, setAllowSkippingBoost] = useState(initial.allowSkippingBoost);
  // Falls back to the shipped placeholders (not an empty array) so an admin opening this for the
  // first time sees — and can immediately start tuning — real starting bands, not a blank form
  // that looks like the feature doesn't exist. See docs/plans/boost-proof-stat-and-value-bands.md.
  const [valueBandRules, setValueBandRules] = useState<BoostPricingRule[]>(
    initial.valueBandRules ?? DEFAULT_VALUE_BAND_RULES,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function updateBand(
    ruleIndex: number,
    bandIndex: number,
    field: "maxValue" | "price7d" | "price15d" | "price30d",
    value: number | null,
  ) {
    setValueBandRules((rules) =>
      rules.map((rule, ri) =>
        ri !== ruleIndex
          ? rule
          : { ...rule, bands: rule.bands.map((band, bi) => (bi !== bandIndex ? band : { ...band, [field]: value })) },
      ),
    );
  }

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
    allowSkippingBoost,
    valueBandRules,
  };
  const anyDurationOn = enabledBoostDurations(parsed).length > 0;
  // Every band's 3 duration prices must be positive integers, and every band but the last
  // (open-ended, maxValue null) needs a positive cutoff — these aren't part of the flat
  // Object.values(prices) sweep above since they're nested, not top-level fields.
  const bandsValid = valueBandRules.every((rule) =>
    rule.bands.every(
      (band, i) =>
        [band.price7d, band.price15d, band.price30d].every((n) => Number.isInteger(n) && n > 0) &&
        (i === rule.bands.length - 1 ? band.maxValue === null : Number.isInteger(band.maxValue) && (band.maxValue ?? 0) > 0),
    ),
  );
  // Only the price fields need this check — the toggles are booleans, not positive integers, so
  // they can't be folded into the same Object.values(...).every(...) sweep.
  const valid = Object.values(prices).every((n) => Number.isInteger(n) && n > 0) && anyDurationOn && bandsValid;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateBoostPricingAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Feature prices updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Durations offered in the Feature card</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
          Unchecked durations are hidden from every Feature picker (web and app) and can&apos;t be bought.
          An Agent Pro member with an unused free monthly Feature still sees the 7-day option.
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <DurationToggle label="7-day Feature" checked={boost7dEnabled} onChange={setBoost7dEnabled} />
          <DurationToggle label="15-day Feature" checked={boost15dEnabled} onChange={setBoost15dEnabled} />
          <DurationToggle label="30-day Feature" checked={boost30dEnabled} onChange={setBoost30dEnabled} />
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
          <Field label="7-day Feature (₹)" value={propertyBoostPrice7d} onChange={setPropertyBoostPrice7d} />
          <Field label="15-day Feature (₹)" value={propertyBoostPrice15d} onChange={setPropertyBoostPrice15d} />
          <Field label="30-day Feature (₹)" value={propertyBoostPrice30d} onChange={setPropertyBoostPrice30d} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Coworking / PG / Storage</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="7-day Feature (₹)"
            value={coworkingPgStorageBoostPrice7d}
            onChange={setCoworkingPgStorageBoostPrice7d}
          />
          <Field
            label="15-day Feature (₹)"
            value={coworkingPgStorageBoostPrice15d}
            onChange={setCoworkingPgStorageBoostPrice15d}
          />
          <Field
            label="30-day Feature (₹)"
            value={coworkingPgStorageBoostPrice30d}
            onChange={setCoworkingPgStorageBoostPrice30d}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Furniture / Interiors</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="7-day Feature (₹)"
            value={furnitureInteriorsBoostPrice7d}
            onChange={setFurnitureInteriorsBoostPrice7d}
          />
          <Field
            label="15-day Feature (₹)"
            value={furnitureInteriorsBoostPrice15d}
            onChange={setFurnitureInteriorsBoostPrice15d}
          />
          <Field
            label="30-day Feature (₹)"
            value={furnitureInteriorsBoostPrice30d}
            onChange={setFurnitureInteriorsBoostPrice30d}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Price bands by listing value</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
          Optional, on top of the flat prices above — see docs/plans/boost-proof-stat-and-value-bands.md.
          When a listing&apos;s category/transaction type matches a rule below, its band price is
          charged instead of the flat tier price. The starting numbers here are placeholders, not
          real percentile data — tune the cutoffs and prices once real listing-price/rent
          distributions can be pulled from production.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {valueBandRules.map((rule, ruleIndex) => (
            <BandRuleEditor
              key={RULE_LABELS[ruleIndex] ?? ruleIndex}
              label={RULE_LABELS[ruleIndex] ?? `Rule ${ruleIndex + 1}`}
              rule={rule}
              onChangeBand={(bandIndex, field, value) => updateBand(ruleIndex, bandIndex, field, value)}
            />
          ))}
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
              Show the Feature selector on the ad Preview step
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              When checked, advertisers pick a plan before posting instead of being offered one
              afterward. The two placements are mutually exclusive — checking this hides the
              post-ad upsell card entirely.
            </span>
          </span>
        </label>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={allowSkippingBoost}
            onChange={(e) => setAllowSkippingBoost(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ fontWeight: 700, fontSize: 14, display: "block" }}>Allow skipping Feature</span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              When checked, the Feature card shows a &quot;Skip — post without featuring&quot; link, on
              both the ad-preview step and the publish-checkout recovery screen. Uncheck to make
              Feature mandatory wherever the card is shown — independent of the platform fee or the
              preview-selector setting above.
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
        {saving ? "Saving…" : "Save Feature prices"}
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

/** One rule's bands as editable rows — cutoff + 3 duration prices each, last row's cutoff fixed
 * to "and above" (not editable: `BoostPricingRule.bands`' last entry must have `maxValue: null`
 * for boostPriceFor's fallback-to-top-band logic to work). Rules/bands aren't addable or
 * removable from this UI — the 6 segments and 3-band shape are fixed by
 * docs/plans/boost-proof-stat-and-value-bands.md; only cutoffs and prices are tunable here. */
function BandRuleEditor({
  label,
  rule,
  onChangeBand,
}: {
  label: string;
  rule: BoostPricingRule;
  onChangeBand: (bandIndex: number, field: "maxValue" | "price7d" | "price15d" | "price30d", value: number | null) => void;
}) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rule.bands.map((band, bandIndex) => {
          const isTopBand = bandIndex === rule.bands.length - 1;
          return (
            <div
              key={bandIndex}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1.2 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
                  Up to (₹)
                </label>
                {isTopBand ? (
                  <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>and above</div>
                ) : (
                  <NumberField value={band.maxValue} onChange={(v) => onChangeBand(bandIndex, "maxValue", v)} />
                )}
              </div>
              <NumberField
                label="7-day (₹)"
                value={band.price7d}
                onChange={(v) => onChangeBand(bandIndex, "price7d", v)}
              />
              <NumberField
                label="15-day (₹)"
                value={band.price15d}
                onChange={(v) => onChangeBand(bandIndex, "price15d", v)}
              />
              <NumberField
                label="30-day (₹)"
                value={band.price30d}
                onChange={(v) => onChangeBand(bandIndex, "price30d", v)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      {label && (
        <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
          {label}
        </label>
      )}
      <input
        type="number"
        min={1}
        value={value ?? ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? null : Number(digits));
        }}
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
