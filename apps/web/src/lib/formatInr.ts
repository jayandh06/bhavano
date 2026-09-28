import { formatInrInWords, groupInr } from "@bhavano/types/priceWords";

/** Shared INR display formatter for the Tools calculators — Indian digit grouping (lakh/crore)
 * plus words, "₹45,00,000 (45 Lakh)", rounded to the nearest rupee. Calculator math itself stays
 * unrounded (`calculatorFormulas.ts`); rounding only happens here, at display time. Negative
 * results (a rent-vs-buy difference) keep their sign on both halves. */
export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  const abs = Math.abs(Math.round(value));
  const sign = value < 0 && abs > 0 ? "-" : "";
  const words = abs >= 1_000 ? ` (${sign}${formatInrInWords(abs).slice(1)})` : "";
  return `${sign}₹${groupInr(abs)}${words}`;
}
