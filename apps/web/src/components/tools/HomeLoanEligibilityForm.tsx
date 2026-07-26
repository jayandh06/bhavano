"use client";

import { useState } from "react";
import { calculateEmi, calculateMaxLoanAmount } from "@/lib/calculatorFormulas";
import { formatInr } from "@/lib/formatInr";
import { CalculatorCard } from "./CalculatorCard";
import { NumberField } from "./NumberField";

export function HomeLoanEligibilityForm() {
  const [monthlyIncome, setMonthlyIncome] = useState("100000");
  const [existingEmis, setExistingEmis] = useState("0");
  const [foirPercent, setFoirPercent] = useState("50");
  const [ratePercent, setRatePercent] = useState("8.5");
  const [tenureYears, setTenureYears] = useState("20");

  const income = Number(monthlyIncome) || 0;
  const existing = Number(existingEmis) || 0;
  const foir = Number(foirPercent) || 0;
  const rate = Number(ratePercent) || 0;
  const years = Number(tenureYears) || 0;
  const hasInputs = income > 0 && years > 0 && foir > 0;

  const maxLoanAmount = hasInputs ? calculateMaxLoanAmount(income, existing, foir, rate, years * 12) : 0;
  const resultingEmi = hasInputs ? calculateEmi(maxLoanAmount, rate, years * 12) : 0;

  return (
    <CalculatorCard
      resultLabel="Estimated maximum loan amount"
      resultValue={
        hasInputs && (
          <>
            {formatInr(maxLoanAmount)}
            <span className="block text-[13px] font-normal text-text-soft mt-1">
              Resulting EMI at this loan amount: {formatInr(resultingEmi)}/month
            </span>
          </>
        )
      }
    >
      <NumberField label="Monthly income" suffix="₹" value={monthlyIncome} onChange={setMonthlyIncome} />
      <NumberField label="Existing monthly EMIs (other loans)" suffix="₹" value={existingEmis} onChange={setExistingEmis} />
      <NumberField label="Max EMI as % of income (FOIR)" suffix="%" value={foirPercent} onChange={setFoirPercent} min={30} />
      <p className="text-[12.5px] text-muted m-0 -mt-2">
        Lenders typically cap your total EMIs (including this new loan) at 40–50% of monthly income. We default to
        50% — adjust if your lender uses a different limit.
      </p>
      <NumberField label="Interest rate" suffix="% p.a." value={ratePercent} onChange={setRatePercent} />
      <NumberField label="Loan tenure" suffix="years" value={tenureYears} onChange={setTenureYears} min={1} />
    </CalculatorCard>
  );
}
