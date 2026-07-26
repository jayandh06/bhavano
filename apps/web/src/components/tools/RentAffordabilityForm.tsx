"use client";

import { useState } from "react";
import { calculateMaxAffordableRent } from "@/lib/calculatorFormulas";
import { formatInr } from "@/lib/formatInr";
import { CalculatorCard } from "./CalculatorCard";
import { NumberField } from "./NumberField";

export function RentAffordabilityForm() {
  const [monthlyIncome, setMonthlyIncome] = useState("60000");
  const [rentPercent, setRentPercent] = useState("35");

  const income = Number(monthlyIncome) || 0;
  const percent = Number(rentPercent) || 0;
  const hasInputs = income > 0 && percent > 0;

  const maxRent = hasInputs ? calculateMaxAffordableRent(income, percent) : 0;

  return (
    <CalculatorCard resultLabel="Suggested maximum monthly rent" resultValue={hasInputs && formatInr(maxRent)}>
      <NumberField label="Monthly income" suffix="₹" value={monthlyIncome} onChange={setMonthlyIncome} />
      <NumberField label="Rent as % of income" suffix="%" value={rentPercent} onChange={setRentPercent} min={10} />
      <p className="text-[12.5px] text-muted m-0 -mt-2">
        Rule of thumb: rent shouldn&apos;t exceed 30–40% of your monthly income. We default to 35% — adjust to your
        own comfort level.
      </p>
    </CalculatorCard>
  );
}
