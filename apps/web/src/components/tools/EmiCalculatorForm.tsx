"use client";

import { useState } from "react";
import { calculateEmi } from "@/lib/calculatorFormulas";
import { formatInr } from "@/lib/formatInr";
import { CalculatorCard } from "./CalculatorCard";
import { NumberField } from "./NumberField";

export function EmiCalculatorForm() {
  const [loanAmount, setLoanAmount] = useState("5000000");
  const [ratePercent, setRatePercent] = useState("8.5");
  const [tenureYears, setTenureYears] = useState("20");

  const principal = Number(loanAmount) || 0;
  const rate = Number(ratePercent) || 0;
  const years = Number(tenureYears) || 0;
  const hasInputs = principal > 0 && years > 0;

  const emi = hasInputs ? calculateEmi(principal, rate, years * 12) : 0;
  const totalPayment = emi * years * 12;
  const totalInterest = totalPayment - principal;

  return (
    <CalculatorCard
      resultLabel="Monthly EMI"
      resultValue={
        hasInputs && (
          <>
            {formatInr(emi)}
            <span className="block text-[13px] font-normal text-text-soft mt-1">
              Total interest: {formatInr(totalInterest)} · Total payment: {formatInr(totalPayment)}
            </span>
          </>
        )
      }
    >
      <NumberField label="Loan amount" suffix="₹" value={loanAmount} onChange={setLoanAmount} />
      <NumberField label="Interest rate" suffix="% p.a." value={ratePercent} onChange={setRatePercent} />
      <NumberField label="Loan tenure" suffix="years" value={tenureYears} onChange={setTenureYears} min={1} />
    </CalculatorCard>
  );
}
