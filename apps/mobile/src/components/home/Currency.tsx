import { useMarket } from "../../lib/market";

/** The market's currency symbol ("₹" in India, "$" in the US), for text that used to hardcode "₹". Render it inside a `Text`. */
export function Currency() {
  return <>{useMarket().currencySymbol}</>;
}
