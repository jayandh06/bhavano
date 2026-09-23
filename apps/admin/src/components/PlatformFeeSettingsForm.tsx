"use client";

import { useState } from "react";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { updatePlatformFeeAction } from "@/app/actions/admin";

export function PlatformFeeSettingsForm({ initial }: { initial: PlatformFeeSettings }) {
  const [propertyListingFee, setPropertyListingFee] = useState(String(initial.propertyListingFee));
  const [coworkingPgStorageListingFee, setCoworkingPgStorageListingFee] = useState(
    String(initial.coworkingPgStorageListingFee),
  );
  const [furnitureInteriorsListingFee, setFurnitureInteriorsListingFee] = useState(
    String(initial.furnitureInteriorsListingFee),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed: PlatformFeeSettings = {
    propertyListingFee: Number(propertyListingFee),
    coworkingPgStorageListingFee: Number(coworkingPgStorageListingFee),
    furnitureInteriorsListingFee: Number(furnitureInteriorsListingFee),
  };
  const valid = Object.values(parsed).every((n) => Number.isInteger(n) && n >= 0);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updatePlatformFeeAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Platform fee updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        Mandatory fee when posting an ad (per category tier). Set a tier to <strong>₹0</strong> to turn off the
        platform fee for that group. Boost and Instant Alerts stay optional add-ons at checkout.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        Property listings (₹)
        <input value={propertyListingFee} onChange={(e) => setPropertyListingFee(e.target.value)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        PG / coworking / storage (₹)
        <input value={coworkingPgStorageListingFee} onChange={(e) => setCoworkingPgStorageListingFee(e.target.value)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        Furniture / interiors (₹)
        <input
          value={furnitureInteriorsListingFee}
          onChange={(e) => setFurnitureInteriorsListingFee(e.target.value)}
        />
      </label>
      <button type="button" disabled={!valid || saving} onClick={() => void onSave()} style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Save platform fee"}
      </button>
      {message && <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "#b3413a" }}>{message.text}</p>}
    </div>
  );
}
