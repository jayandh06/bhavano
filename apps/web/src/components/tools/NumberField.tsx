"use client";

import { fieldClass, labelClass } from "@/lib/formStyles";

/** Labeled numeric input shared by every calculator form — kept as a plain string in the
 * caller's state (not parsed to a number here) so an empty/in-progress field doesn't force a
 * premature `0`. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  min?: number;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {suffix ? ` (${suffix})` : ""}
      </label>
      <input type="number" min={min} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </div>
  );
}
