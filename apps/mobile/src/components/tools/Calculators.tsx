import { useState, type ComponentType } from "react";
import {
  AREA_UNIT_LABELS,
  calculateDownPaymentFromLoanAmount,
  calculateDownPaymentFromLtv,
  calculateEmi,
  calculateMaxAffordableRent,
  calculateMaxLoanAmount,
  calculateRentVsBuy,
  convertArea,
  type AreaUnit,
} from "@bhavano/types/calculatorFormulas";
import { formatInr } from "../../lib/formatInr";
import { Choice, NumberField, Note, ResultCard } from "./ToolFields";

// The six forms mirror apps/web/src/components/tools/*Form.tsx field for field, with the same
// defaults and the same maths (shared in @bhavano/types/calculatorFormulas), so the two never
// disagree on a result.

function EmiCalculator() {
  const [loanAmount, setLoanAmount] = useState("5000000");
  const [ratePercent, setRatePercent] = useState("8.5");
  const [tenureYears, setTenureYears] = useState("20");

  const principal = Number(loanAmount) || 0;
  const rate = Number(ratePercent) || 0;
  const years = Number(tenureYears) || 0;
  const hasInputs = principal > 0 && years > 0;

  const emi = hasInputs ? calculateEmi(principal, rate, years * 12) : 0;
  const totalPayment = emi * years * 12;

  return (
    <>
      <NumberField label="Loan amount" suffix="₹" value={loanAmount} onChange={setLoanAmount} />
      <NumberField label="Interest rate" suffix="% p.a." value={ratePercent} onChange={setRatePercent} />
      <NumberField label="Loan tenure" suffix="years" value={tenureYears} onChange={setTenureYears} />
      <ResultCard
        label="Monthly EMI"
        value={hasInputs && formatInr(emi)}
        detail={`Total interest: ${formatInr(totalPayment - principal)} · Total payment: ${formatInr(totalPayment)}`}
      />
    </>
  );
}

function HomeLoanEligibilityCalculator() {
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
    <>
      <NumberField label="Monthly income" suffix="₹" value={monthlyIncome} onChange={setMonthlyIncome} />
      <NumberField label="Existing monthly EMIs (other loans)" suffix="₹" value={existingEmis} onChange={setExistingEmis} />
      <NumberField label="Max EMI as % of income (FOIR)" suffix="%" value={foirPercent} onChange={setFoirPercent} />
      <Note>
        Lenders typically cap your total EMIs (including this new loan) at 40–50% of monthly income. We default to 50% —
        adjust if your lender uses a different limit.
      </Note>
      <NumberField label="Interest rate" suffix="% p.a." value={ratePercent} onChange={setRatePercent} />
      <NumberField label="Loan tenure" suffix="years" value={tenureYears} onChange={setTenureYears} />
      <ResultCard
        label="Estimated maximum loan amount"
        value={hasInputs && formatInr(maxLoanAmount)}
        detail={`Resulting EMI at this loan amount: ${formatInr(resultingEmi)}/month`}
      />
    </>
  );
}

const AREA_UNITS = (Object.keys(AREA_UNIT_LABELS) as AreaUnit[]).map((unit) => ({
  value: unit,
  label: AREA_UNIT_LABELS[unit],
}));

function AreaUnitConverter() {
  const [value, setValue] = useState("1000");
  const [fromUnit, setFromUnit] = useState<AreaUnit>("sqft");
  const [toUnit, setToUnit] = useState<AreaUnit>("sqm");

  const numericValue = Number(value) || 0;
  const converted = numericValue > 0 ? convertArea(numericValue, fromUnit, toUnit) : 0;

  return (
    <>
      <NumberField label="Value" value={value} onChange={setValue} />
      <Choice label="From" options={AREA_UNITS} value={fromUnit} onChange={setFromUnit} />
      <Choice label="To" options={AREA_UNITS} value={toUnit} onChange={setToUnit} />
      <ResultCard
        label="Converted area"
        value={
          numericValue > 0 && `${converted.toLocaleString("en-IN", { maximumFractionDigits: 4 })} ${AREA_UNIT_LABELS[toUnit]}`
        }
      />
    </>
  );
}

function RentAffordabilityCalculator() {
  const [monthlyIncome, setMonthlyIncome] = useState("60000");
  const [rentPercent, setRentPercent] = useState("35");

  const income = Number(monthlyIncome) || 0;
  const percent = Number(rentPercent) || 0;
  const hasInputs = income > 0 && percent > 0;

  return (
    <>
      <NumberField label="Monthly income" suffix="₹" value={monthlyIncome} onChange={setMonthlyIncome} />
      <NumberField label="Rent as % of income" suffix="%" value={rentPercent} onChange={setRentPercent} />
      <Note>
        Rule of thumb: rent shouldn&rsquo;t exceed 30–40% of your monthly income. We default to 35% — adjust to your own
        comfort level.
      </Note>
      <ResultCard
        label="Suggested maximum monthly rent"
        value={hasInputs && formatInr(calculateMaxAffordableRent(income, percent))}
      />
    </>
  );
}

function RentVsBuyCalculator() {
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
    <>
      <NumberField label="Property price" suffix="₹" value={propertyPrice} onChange={setPropertyPrice} />
      <NumberField label="Down payment" suffix="%" value={downPaymentPercent} onChange={setDownPaymentPercent} />
      <NumberField label="Loan interest rate" suffix="% p.a." value={ratePercent} onChange={setRatePercent} />
      <NumberField label="Loan tenure" suffix="years" value={loanTenureYears} onChange={setLoanTenureYears} />
      <NumberField label="Current monthly rent" suffix="₹" value={currentMonthlyRent} onChange={setCurrentMonthlyRent} />
      <NumberField label="Annual rent increase" suffix="%" value={rentEscalationPercent} onChange={setRentEscalationPercent} />
      <NumberField
        label="Annual property appreciation"
        suffix="%"
        value={appreciationPercent}
        onChange={setAppreciationPercent}
      />
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
      <NumberField label="Compare over" suffix="years" value={horizonYears} onChange={setHorizonYears} />
      {result && (
        <ResultCard
          label={result.difference >= 0 ? "Buying is cheaper by" : "Renting is cheaper by"}
          value={formatInr(Math.abs(result.difference))}
          detail={`Total rent paid over ${horizon} years: ${formatInr(result.totalRentCost)} · Net cost of buying: ${formatInr(
            result.netCostOfBuying,
          )} (property value ${formatInr(result.propertyValueAtHorizon)} minus ${formatInr(result.outstandingLoanAtHorizon)} loan remaining)`}
        />
      )}
      <Note>
        A simple comparison of cash paid out over the period you choose. It leaves out what the down payment could have
        earned elsewhere, home-loan tax deductions, resale and brokerage costs, and rental income if you rented the
        property out.
      </Note>
    </>
  );
}

type DownPaymentMode = "ltv" | "loanAmount";

function DownPaymentCalculator() {
  const [mode, setMode] = useState<DownPaymentMode>("ltv");
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
    <>
      <Choice
        label="I know my…"
        options={[
          { value: "ltv", label: "Loan-to-value %" },
          { value: "loanAmount", label: "Desired loan amount" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <NumberField label="Property price" suffix="₹" value={propertyPrice} onChange={setPropertyPrice} />
      {mode === "ltv" ? (
        <NumberField label="Loan-to-value" suffix="%" value={ltvPercent} onChange={setLtvPercent} />
      ) : (
        <NumberField label="Desired loan amount" suffix="₹" value={desiredLoanAmount} onChange={setDesiredLoanAmount} />
      )}
      <ResultCard
        label="Down payment required"
        value={hasResult && formatInr(downPayment)}
        detail={`Loan amount: ${formatInr(loanAmount)}${
          loanAmountResult ? ` (${loanAmountResult.impliedLtvPercent.toFixed(1)}% LTV)` : ""
        }`}
      />
    </>
  );
}

/** Keyed by the website path's last segment (see toolsRegistry). */
export const CALCULATORS: Record<string, ComponentType> = {
  "emi-calculator": EmiCalculator,
  "home-loan-eligibility-calculator": HomeLoanEligibilityCalculator,
  "area-unit-converter": AreaUnitConverter,
  "rent-affordability-calculator": RentAffordabilityCalculator,
  "rent-vs-buy-calculator": RentVsBuyCalculator,
  "down-payment-calculator": DownPaymentCalculator,
};
