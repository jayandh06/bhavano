/** Pure math for the /tools calculators — no React, no rounding (round only at display time in
 * the components that call these). All money amounts are INR, unscaled (e.g. 5000000, not "50L"). */

/** Standard reducing-balance EMI: `r` is the monthly rate, `tenureMonths` the loan term in months. */
export function calculateEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}

/** Remaining principal after `monthsElapsed` of an `n`-month amortizing loan — used by the
 * Rent vs. Buy calculator to value the buyer's equity at the comparison horizon. */
export function remainingLoanBalance(loanAmount: number, annualRatePercent: number, n: number, monthsElapsed: number): number {
  if (monthsElapsed >= n) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return loanAmount * (1 - monthsElapsed / n);
  const factorN = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, monthsElapsed);
  return (loanAmount * (factorN - factorK)) / (factorN - 1);
}

/** EMI formula solved for principal — how large a loan a given monthly payment supports. */
export function calculateMaxLoanAmount(
  monthlyIncome: number,
  existingMonthlyEmis: number,
  foirPercent: number,
  annualRatePercent: number,
  tenureMonths: number,
): number {
  const availableEmi = Math.max(0, monthlyIncome * (foirPercent / 100) - existingMonthlyEmis);
  if (availableEmi === 0) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return availableEmi * tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (availableEmi * (factor - 1)) / (r * factor);
}

export type AreaUnit = "sqft" | "sqm" | "acre" | "hectare" | "cent";

export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  sqft: "Square feet",
  sqm: "Square metres",
  acre: "Acre",
  hectare: "Hectare",
  cent: "Cent",
};

/** Canonical base is square metres (the one exact SI unit) — every other factor is derived from
 * it once, rather than hand-maintaining an N×N conversion table. */
export const AREA_UNIT_TO_SQM: Record<AreaUnit, number> = {
  sqft: 0.09290304, // exact: (0.3048 m)^2
  sqm: 1,
  acre: 4046.8564224, // exact: 43,560 sqft
  hectare: 10000, // exact, by definition
  cent: 40.468564224, // exact: acre / 100
};

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return (value * AREA_UNIT_TO_SQM[from]) / AREA_UNIT_TO_SQM[to];
}

/** Simple income-ratio rule of thumb — no interaction with other obligations. */
export function calculateMaxAffordableRent(monthlyIncome: number, rentPercent: number): number {
  return monthlyIncome * (rentPercent / 100);
}

export function calculateDownPaymentFromLtv(propertyPrice: number, ltvPercent: number): { downPayment: number; loanAmount: number } {
  const loanAmount = propertyPrice * (ltvPercent / 100);
  return { downPayment: propertyPrice - loanAmount, loanAmount };
}

export function calculateDownPaymentFromLoanAmount(
  propertyPrice: number,
  desiredLoanAmount: number,
): { downPayment: number; impliedLtvPercent: number } {
  return { downPayment: propertyPrice - desiredLoanAmount, impliedLtvPercent: (desiredLoanAmount / propertyPrice) * 100 };
}

export interface RentVsBuyInputs {
  propertyPrice: number;
  downPaymentPercent: number;
  annualRatePercent: number;
  loanTenureYears: number;
  currentMonthlyRent: number;
  annualRentEscalationPercent: number;
  annualPropertyAppreciationPercent: number;
  /** Combined maintenance + property tax, as a % of the property's *current* (appreciated) value each year. */
  annualOwnershipCostPercent: number;
  /** One-time stamp duty + registration, as a % of property price — a rough India-wide average; varies by state. */
  oneTimeBuyingCostPercent: number;
  comparisonHorizonYears: number;
}

export interface RentVsBuyResult {
  totalRentCost: number;
  netCostOfBuying: number;
  propertyValueAtHorizon: number;
  outstandingLoanAtHorizon: number;
  netEquityAtHorizon: number;
  /** totalRentCost - netCostOfBuying — positive means buying works out cheaper over the horizon. */
  difference: number;
}

/** Undiscounted nominal cash-flow comparison over `comparisonHorizonYears` — deliberately not
 * NPV/time-value-adjusted, and deliberately excludes opportunity cost of the down payment,
 * home-loan tax deductions, resale/brokerage costs, and rental yield if the property were rented
 * out instead. Callers must surface these exclusions in the page copy, not just this comment. */
export function calculateRentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  const {
    propertyPrice: P,
    downPaymentPercent: dp,
    annualRatePercent,
    loanTenureYears: nLoanYears,
    currentMonthlyRent: R0,
    annualRentEscalationPercent: gRent,
    annualPropertyAppreciationPercent: gProp,
    annualOwnershipCostPercent: m,
    oneTimeBuyingCostPercent,
    comparisonHorizonYears: H,
  } = inputs;

  const downPayment = P * (dp / 100);
  const loanAmount = P - downPayment;
  const monthlyEmi = calculateEmi(loanAmount, annualRatePercent, nLoanYears * 12);

  let buyOutflow = downPayment + P * (oneTimeBuyingCostPercent / 100);
  let rentCost = 0;
  for (let y = 1; y <= H; y++) {
    const emiPaidThisYear = y <= nLoanYears ? monthlyEmi * 12 : 0;
    const ownershipCostThisYear = P * Math.pow(1 + gProp / 100, y) * (m / 100);
    buyOutflow += emiPaidThisYear + ownershipCostThisYear;

    const monthlyRentThisYear = R0 * Math.pow(1 + gRent / 100, y - 1);
    rentCost += monthlyRentThisYear * 12;
  }

  const propertyValueAtHorizon = P * Math.pow(1 + gProp / 100, H);
  const monthsElapsed = Math.min(H, nLoanYears) * 12;
  const outstandingLoanAtHorizon = remainingLoanBalance(loanAmount, annualRatePercent, nLoanYears * 12, monthsElapsed);
  const netEquityAtHorizon = propertyValueAtHorizon - outstandingLoanAtHorizon;
  const netCostOfBuying = buyOutflow - netEquityAtHorizon;

  return {
    totalRentCost: rentCost,
    netCostOfBuying,
    propertyValueAtHorizon,
    outstandingLoanAtHorizon,
    netEquityAtHorizon,
    difference: rentCost - netCostOfBuying,
  };
}
