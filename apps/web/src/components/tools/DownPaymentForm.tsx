"use client";

import Link from "next/link";
import { useState } from "react";
import { calculateDownPaymentFromLoanAmount, calculateDownPaymentFromLtv } from "@/lib/calculatorFormulas";
import { formatInr } from "@/lib/formatInr";
import { labelClass, secondaryButtonClass } from "@/lib/formStyles";
import { CalculatorCard } from "./CalculatorCard";
import { NumberField } from "./NumberField";

type Mode = "ltv" | "loanAmount";

export function DownPaymentForm() {
  const [mode, setMode] = useState<Mode>("ltv");
  const [propertyPrice, setPropertyPrice] = useState("6000000");
  const [ltvPercent, setLtvPercent] = useState("80");
  const [desiredLoanAmount, setDesiredLoanAmount] = useState("4800000");

  const price = Number(propertyPrice) || 0;
  const hasInputs = price > 0;

  const ltvResult = mode === "ltv" && hasInputs ? calculateDownPaymentFromLtv(price, Number(ltvPercent) || 0) : null;
  const loanAmountResult =
    mode === "loanAmount" && hasInputs ? calculateDownPaymentFromLoanAmount(price, Number(desiredLoanAmount) || 0) : null;

  const downPayment = ltvResult?.downPayment ?? loanAmountResult?.downPayment ?? 0;
  const loanAmount = ltvResult?.loanAmount ?? (Number(desiredLoanAmount) || 0);
  const hasResult = ltvResult !== null || loanAmountResult !== null;

  return (
    <CalculatorCard
      resultLabel="Down payment required"
      resultValue={
        hasResult && (
          <>
            {formatInr(downPayment)}
            <span className="block text-[13px] font-normal text-text-soft mt-1">
              Loan amount: {formatInr(loanAmount)}
              {loanAmountResult && ` (${loanAmountResult.impliedLtvPercent.toFixed(1)}% LTV)`}
            </span>
          </>
        )
      }
    >
      <div>
        <label className={labelClass}>I know my…</label>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setMode("ltv")}
            className={`${secondaryButtonClass} ${mode === "ltv" ? "text-green" : ""}`}
          >
            Loan-to-value %
          </button>
          <button
            type="button"
            onClick={() => setMode("loanAmount")}
            className={`${secondaryButtonClass} ${mode === "loanAmount" ? "text-green" : ""}`}
          >
            Desired loan amount
          </button>
        </div>
      </div>
      <NumberField label="Property price" suffix="₹" value={propertyPrice} onChange={setPropertyPrice} />
      {mode === "ltv" ? (
        <NumberField label="Loan-to-value" suffix="%" value={ltvPercent} onChange={setLtvPercent} min={1} />
      ) : (
        <NumberField label="Desired loan amount" suffix="₹" value={desiredLoanAmount} onChange={setDesiredLoanAmount} />
      )}
      <p className="text-[12.5px] text-muted m-0">
        See the EMI for this loan amount on the{" "}
        <Link href="/tools/emi-calculator" className="text-green font-bold">
          EMI Calculator
        </Link>
        .
      </p>
    </CalculatorCard>
  );
}
