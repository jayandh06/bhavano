"use client";

import { useState } from "react";
import { calculateRentVsBuy } from "@/lib/calculatorFormulas";
import { formatInr } from "@/lib/formatInr";
import { CalculatorCard } from "./CalculatorCard";
import { NumberField } from "./NumberField";

export function RentVsBuyForm() {
  const [propertyPrice, setPropertyPrice] = useState("6000000");
  const [downPaymentPercent, setDownPaymentPercent] = useState("20");
  const [ratePercent, setRatePercent] = useState("8.5");
  const [loanTenureYears, setLoanTenureYears] = useState("20");
  const [currentMonthlyRent, setCurrentMonthlyRent] = useState("25000");
  const [rentEscalationPercent, setRentEscalationPercent] = useState("5");
  const [appreciationPercent, setAppreciationPercent] = useState("5");
  const [ownershipCostPercent, setOwnershipCostPercent] = useState("1.5");
  const [buyingCostPercent, setBuyingCostPercent] = useState("7");
  const [horizonYears, setHorizonYears] = useState("10");

  const price = Number(propertyPrice) || 0;
  const horizon = Number(horizonYears) || 0;
  const hasInputs = price > 0 && horizon > 0 && Number(currentMonthlyRent) > 0;

  const result = hasInputs
    ? calculateRentVsBuy({
        propertyPrice: price,
        downPaymentPercent: Number(downPaymentPercent) || 0,
        annualRatePercent: Number(ratePercent) || 0,
        loanTenureYears: Number(loanTenureYears) || 0,
        currentMonthlyRent: Number(currentMonthlyRent) || 0,
        annualRentEscalationPercent: Number(rentEscalationPercent) || 0,
        annualPropertyAppreciationPercent: Number(appreciationPercent) || 0,
        annualOwnershipCostPercent: Number(ownershipCostPercent) || 0,
        oneTimeBuyingCostPercent: Number(buyingCostPercent) || 0,
        comparisonHorizonYears: horizon,
      })
    : null;

  return (
    <CalculatorCard
      resultLabel={result ? (result.difference >= 0 ? "Buying is cheaper by" : "Renting is cheaper by") : undefined}
      resultValue={
        result && (
          <>
            {formatInr(Math.abs(result.difference))}
            <span className="block text-[13px] font-normal text-text-soft mt-1">
              Total rent paid over {horizon} years: {formatInr(result.totalRentCost)} · Net cost of buying:{" "}
              {formatInr(result.netCostOfBuying)} (property value {formatInr(result.propertyValueAtHorizon)} minus{" "}
              {formatInr(result.outstandingLoanAtHorizon)} loan remaining)
            </span>
          </>
        )
      }
    >
      <NumberField label="Property price" suffix="₹" value={propertyPrice} onChange={setPropertyPrice} />
      <NumberField label="Down payment" suffix="%" value={downPaymentPercent} onChange={setDownPaymentPercent} />
      <NumberField label="Loan interest rate" suffix="% p.a." value={ratePercent} onChange={setRatePercent} />
      <NumberField label="Loan tenure" suffix="years" value={loanTenureYears} onChange={setLoanTenureYears} min={1} />
      <NumberField label="Current monthly rent" suffix="₹" value={currentMonthlyRent} onChange={setCurrentMonthlyRent} />
      <NumberField label="Annual rent increase" suffix="%" value={rentEscalationPercent} onChange={setRentEscalationPercent} />
      <NumberField label="Annual property appreciation" suffix="%" value={appreciationPercent} onChange={setAppreciationPercent} />
      <NumberField
        label="Annual maintenance + property tax"
        suffix="% of value"
        value={ownershipCostPercent}
        onChange={setOwnershipCostPercent}
      />
      <NumberField
        label="One-time stamp duty + registration"
        suffix="% of price"
        value={buyingCostPercent}
        onChange={setBuyingCostPercent}
      />
      <NumberField label="Compare over" suffix="years" value={horizonYears} onChange={setHorizonYears} min={1} />
    </CalculatorCard>
  );
}
