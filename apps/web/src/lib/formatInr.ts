/** Shared INR display formatter for the Tools calculators — Indian digit grouping (lakh/crore),
 * rounded to the nearest rupee. Calculator math itself stays unrounded (`calculatorFormulas.ts`);
 * rounding only happens here, at display time. */
export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
