"use strict";
/** Pure math for the /tools calculators — no React, no rounding (round only at display time in
 * the components that call these). All money amounts are INR, unscaled (e.g. 5000000, not "50L"). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertArea = exports.AREA_UNIT_TO_SQM = exports.AREA_UNIT_LABELS = void 0;
exports.calculateEmi = calculateEmi;
exports.remainingLoanBalance = remainingLoanBalance;
exports.calculateMaxLoanAmount = calculateMaxLoanAmount;
exports.calculateMaxAffordableRent = calculateMaxAffordableRent;
exports.calculateDownPaymentFromLtv = calculateDownPaymentFromLtv;
exports.calculateDownPaymentFromLoanAmount = calculateDownPaymentFromLoanAmount;
exports.calculateRentVsBuy = calculateRentVsBuy;
/** Standard reducing-balance EMI: `r` is the monthly rate, `tenureMonths` the loan term in months. */
function calculateEmi(principal, annualRatePercent, tenureMonths) {
    const r = annualRatePercent / 12 / 100;
    if (r === 0)
        return principal / tenureMonths;
    const factor = Math.pow(1 + r, tenureMonths);
    return (principal * r * factor) / (factor - 1);
}
/** Remaining principal after `monthsElapsed` of an `n`-month amortizing loan — used by the
 * Rent vs. Buy calculator to value the buyer's equity at the comparison horizon. */
function remainingLoanBalance(loanAmount, annualRatePercent, n, monthsElapsed) {
    if (monthsElapsed >= n)
        return 0;
    const r = annualRatePercent / 12 / 100;
    if (r === 0)
        return loanAmount * (1 - monthsElapsed / n);
    const factorN = Math.pow(1 + r, n);
    const factorK = Math.pow(1 + r, monthsElapsed);
    return (loanAmount * (factorN - factorK)) / (factorN - 1);
}
/** EMI formula solved for principal — how large a loan a given monthly payment supports. */
function calculateMaxLoanAmount(monthlyIncome, existingMonthlyEmis, foirPercent, annualRatePercent, tenureMonths) {
    const availableEmi = Math.max(0, monthlyIncome * (foirPercent / 100) - existingMonthlyEmis);
    if (availableEmi === 0)
        return 0;
    const r = annualRatePercent / 12 / 100;
    if (r === 0)
        return availableEmi * tenureMonths;
    const factor = Math.pow(1 + r, tenureMonths);
    return (availableEmi * (factor - 1)) / (r * factor);
}
var areaUnit_1 = require("./areaUnit");
Object.defineProperty(exports, "AREA_UNIT_LABELS", { enumerable: true, get: function () { return areaUnit_1.AREA_UNIT_LABELS; } });
Object.defineProperty(exports, "AREA_UNIT_TO_SQM", { enumerable: true, get: function () { return areaUnit_1.AREA_UNIT_TO_SQM; } });
Object.defineProperty(exports, "convertArea", { enumerable: true, get: function () { return areaUnit_1.convertArea; } });
/** Simple income-ratio rule of thumb — no interaction with other obligations. */
function calculateMaxAffordableRent(monthlyIncome, rentPercent) {
    return monthlyIncome * (rentPercent / 100);
}
function calculateDownPaymentFromLtv(propertyPrice, ltvPercent) {
    const loanAmount = propertyPrice * (ltvPercent / 100);
    return { downPayment: propertyPrice - loanAmount, loanAmount };
}
function calculateDownPaymentFromLoanAmount(propertyPrice, desiredLoanAmount) {
    return { downPayment: propertyPrice - desiredLoanAmount, impliedLtvPercent: (desiredLoanAmount / propertyPrice) * 100 };
}
/** Undiscounted nominal cash-flow comparison over `comparisonHorizonYears` — deliberately not
 * NPV/time-value-adjusted, and deliberately excludes opportunity cost of the down payment,
 * home-loan tax deductions, resale/brokerage costs, and rental yield if the property were rented
 * out instead. Callers must surface these exclusions in the page copy, not just this comment. */
function calculateRentVsBuy(inputs) {
    const { propertyPrice: P, downPaymentPercent: dp, annualRatePercent, loanTenureYears: nLoanYears, currentMonthlyRent: R0, annualRentEscalationPercent: gRent, annualPropertyAppreciationPercent: gProp, annualOwnershipCostPercent: m, oneTimeBuyingCostPercent, comparisonHorizonYears: H, } = inputs;
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
