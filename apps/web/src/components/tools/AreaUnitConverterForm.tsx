"use client";

import { useState } from "react";
import { AREA_UNIT_LABELS, type AreaUnit, convertArea } from "@/lib/calculatorFormulas";
import { fieldClass, labelClass } from "@/lib/formStyles";
import { CalculatorCard } from "./CalculatorCard";
import { NumberField } from "./NumberField";

const AREA_UNITS = Object.keys(AREA_UNIT_LABELS) as AreaUnit[];

export function AreaUnitConverterForm() {
  const [value, setValue] = useState("1000");
  const [fromUnit, setFromUnit] = useState<AreaUnit>("sqft");
  const [toUnit, setToUnit] = useState<AreaUnit>("sqm");

  const numericValue = Number(value) || 0;
  const hasInputs = numericValue > 0;
  const converted = hasInputs ? convertArea(numericValue, fromUnit, toUnit) : 0;

  return (
    <CalculatorCard
      resultLabel="Converted area"
      resultValue={
        hasInputs && (
          <>
            {converted.toLocaleString("en-IN", { maximumFractionDigits: 4 })} {AREA_UNIT_LABELS[toUnit]}
          </>
        )
      }
    >
      <NumberField label="Value" value={value} onChange={setValue} />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>From</label>
          <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value as AreaUnit)} className={fieldClass}>
            {AREA_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {AREA_UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelClass}>To</label>
          <select value={toUnit} onChange={(e) => setToUnit(e.target.value as AreaUnit)} className={fieldClass}>
            {AREA_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {AREA_UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </CalculatorCard>
  );
}
