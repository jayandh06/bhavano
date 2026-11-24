"use client";

import { useMarket } from "@/lib/useMarket";

/** The market's currency symbol ("₹" in India, "$" in the US), for JSX that used to hardcode "₹" in the text. */
export function Currency() {
  return <>{useMarket().currencySymbol}</>;
}
