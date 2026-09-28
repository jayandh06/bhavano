/**
 * Pulled out of PostAdWizard.tsx (the iOS success-screen price teaser) so this arithmetic is
 * testable without importing that file — which pulls in react-native, expo-image-picker,
 * expo-web-browser and the rest of the wizard's native-module graph just to reach two pure
 * functions.
 */
export type PriceLike = { amount: number; originalAmount: number; discountApplied: boolean; free: boolean };

export function priceSuffix(opt?: PriceLike): string {
  if (!opt) return "";
  if (opt.free) return " — Free";
  return opt.discountApplied && opt.originalAmount > opt.amount
    ? ` — ₹${opt.originalAmount} → ₹${opt.amount}`
    : ` — ₹${opt.amount}`;
}
