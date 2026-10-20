import { formatInrInWords, groupInr } from "@bhavano/types/priceWords";

/** Same display formatter as the website's Tools calculators (apps/web/src/lib/formatInr.ts):
 * Indian digit grouping plus words, "₹45,00,000 (45 Lakh)", rounded to the nearest rupee. */
export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  const abs = Math.abs(Math.round(value));
  const sign = value < 0 && abs > 0 ? "-" : "";
  const words = abs >= 1_000 ? ` (${sign}${formatInrInWords(abs).slice(1)})` : "";
  return `${sign}₹${groupInr(abs)}${words}`;
}
