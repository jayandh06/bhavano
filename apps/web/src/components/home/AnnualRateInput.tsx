"use client";

import { useState } from "react";
import { annualRatePerSqft, monthlyFromAnnualRate } from "@bhavano/types/priceQualifiers";
import type { AreaUnit } from "@bhavano/types/areaUnit";
import { fieldClass } from "@/lib/formStyles";

/** US commercial rent is quoted per square foot per year; the ad's price is monthly. Typing a rate here fills the monthly
 * price from the area, and typing a monthly price shows its rate. See docs/plans/us-listing-model.md, phase 4. */
export function AnnualRateInput({
  price,
  area,
  unit,
  onMonthly,
}: {
  /** The monthly price as typed. */
  price: string;
  area: number;
  unit: AreaUnit;
  /** The monthly price the typed rate comes to, or "" when it comes to nothing. */
  onMonthly: (monthly: string) => void;
}) {
  // What is being typed, so "24." is not rewritten under the cursor; otherwise the price's own rate.
  const [typed, setTyped] = useState<string | null>(null);
  const hasArea = area > 0;
  const derived = annualRatePerSqft(Number(price), area, unit);
  const value = typed ?? (derived === null ? "" : derived.toFixed(2));

  return (
    <label className="mt-2 block">
      <span className="block text-[13px] font-bold text-text-soft mb-1">Or yearly rate per sq ft ($)</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={!hasArea}
        maxLength={8}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9.]/g, "");
          setTyped(next);
          const monthly = monthlyFromAnnualRate(Number(next), area, unit);
          onMonthly(monthly === null ? "" : String(monthly));
        }}
        onBlur={() => setTyped(null)}
        className={`${fieldClass} disabled:opacity-60`}
      />
      <span className="block text-xs text-muted mt-1">
        {hasArea ? "Fills the monthly price above: rate × area ÷ 12." : "Enter the area first."}
      </span>
    </label>
  );
}
