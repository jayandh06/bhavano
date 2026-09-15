"use client";

import { useState } from "react";
import type { SubscriptionPlanSettings } from "@bhavano/types/subscriptionPricing";
import { updateSubscriptionPlanAction } from "@/app/actions/admin";

export function SubscriptionPlanSettingsForm({ initial }: { initial: SubscriptionPlanSettings }) {
  const [freeListingSlots, setFreeListingSlots] = useState(String(initial.freeListingSlots));
  const [sellerSlotPackTotalSlots, setSellerSlotPackTotalSlots] = useState(String(initial.sellerSlotPackTotalSlots));
  const [sellerSlotPackMonthlyPrice, setSellerSlotPackMonthlyPrice] = useState(
    String(initial.sellerSlotPackMonthlyPrice),
  );
  const [proListingSlotsPerUnit, setProListingSlotsPerUnit] = useState(String(initial.proListingSlotsPerUnit));
  const [agentProMonthlyPricePerUnit, setAgentProMonthlyPricePerUnit] = useState(
    String(initial.agentProMonthlyPricePerUnit),
  );
  const [buyerPremiumPrice1Month, setBuyerPremiumPrice1Month] = useState(String(initial.buyerPremiumPrice1Month));
  const [buyerPremiumPrice6Months, setBuyerPremiumPrice6Months] = useState(String(initial.buyerPremiumPrice6Months));
  const [buyerPremiumPrice12Months, setBuyerPremiumPrice12Months] = useState(
    String(initial.buyerPremiumPrice12Months),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed: SubscriptionPlanSettings = {
    freeListingSlots: Number(freeListingSlots),
    sellerSlotPackTotalSlots: Number(sellerSlotPackTotalSlots),
    sellerSlotPackMonthlyPrice: Number(sellerSlotPackMonthlyPrice),
    proListingSlotsPerUnit: Number(proListingSlotsPerUnit),
    agentProMonthlyPricePerUnit: Number(agentProMonthlyPricePerUnit),
    buyerPremiumPrice1Month: Number(buyerPremiumPrice1Month),
    buyerPremiumPrice6Months: Number(buyerPremiumPrice6Months),
    buyerPremiumPrice12Months: Number(buyerPremiumPrice12Months),
  };
  const valid = Object.values(parsed).every((n) => Number.isInteger(n) && n > 0);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateSubscriptionPlanAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Subscription plans updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Free seller</div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          Every seller starts with this many concurrent active listings, no subscription needed.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Free listing slots" value={freeListingSlots} onChange={setFreeListingSlots} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Seller slot pack</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="Total slots (not extra)"
            value={sellerSlotPackTotalSlots}
            onChange={setSellerSlotPackTotalSlots}
          />
          <Field label="Price / month (₹)" value={sellerSlotPackMonthlyPrice} onChange={setSellerSlotPackMonthlyPrice} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Agent/Broker Pro</div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          Stackable — a broker buying multiple units gets this many slots per unit.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Slots per unit" value={proListingSlotsPerUnit} onChange={setProListingSlotsPerUnit} />
          <Field
            label="Price / unit / month (₹)"
            value={agentProMonthlyPricePerUnit}
            onChange={setAgentProMonthlyPricePerUnit}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Bhavano Plus (buyer premium)</div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          Buyer-side plan — Verified Buyer badge, inbox priority, early saved-search alerts. No
          extra listing slots or contact reveals.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="1 month (₹)" value={buyerPremiumPrice1Month} onChange={setBuyerPremiumPrice1Month} />
          <Field label="6 months (₹)" value={buyerPremiumPrice6Months} onChange={setBuyerPremiumPrice6Months} />
          <Field label="12 months (₹)" value={buyerPremiumPrice12Months} onChange={setBuyerPremiumPrice12Months} />
        </div>
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
        {saving ? "Saving…" : "Save subscription plans"}
      </button>
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
