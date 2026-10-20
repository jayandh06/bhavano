/** Pure math for the /tools calculators — no React, no rounding (round only at display time in
 * the components that call these). All money amounts are INR, unscaled (e.g. 5000000, not "50L"). */
/** Standard reducing-balance EMI: `r` is the monthly rate, `tenureMonths` the loan term in months. */
export declare function calculateEmi(principal: number, annualRatePercent: number, tenureMonths: number): number;
/** Remaining principal after `monthsElapsed` of an `n`-month amortizing loan — used by the
 * Rent vs. Buy calculator to value the buyer's equity at the comparison horizon. */
export declare function remainingLoanBalance(loanAmount: number, annualRatePercent: number, n: number, monthsElapsed: number): number;
/** EMI formula solved for principal — how large a loan a given monthly payment supports. */
export declare function calculateMaxLoanAmount(monthlyIncome: number, existingMonthlyEmis: number, foirPercent: number, annualRatePercent: number, tenureMonths: number): number;
/** Moved to @bhavano/types/areaUnit so a listing's own area field (Plot/Commercial's unit picker)
 * and this calculator share one vocabulary — re-exported here so this page's existing imports
 * don't need to change. */
export type { AreaUnit } from "./areaUnit";
export { AREA_UNIT_LABELS, AREA_UNIT_TO_SQM, convertArea } from "./areaUnit";
/** Simple income-ratio rule of thumb — no interaction with other obligations. */
export declare function calculateMaxAffordableRent(monthlyIncome: number, rentPercent: number): number;
export declare function calculateDownPaymentFromLtv(propertyPrice: number, ltvPercent: number): {
    downPayment: number;
    loanAmount: number;
};
export declare function calculateDownPaymentFromLoanAmount(propertyPrice: number, desiredLoanAmount: number): {
    downPayment: number;
    impliedLtvPercent: number;
};
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
export declare function calculateRentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult;
