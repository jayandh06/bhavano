import RazorpayCheckout from "react-native-razorpay";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { createBoostOrder } from "./bffClient";
import { isRazorpayUserCancel, razorpayFailureMessage } from "./razorpayNative";

export type BoostCheckoutResult =
  | { outcome: "activated" }
  | { outcome: "paid" }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

/**
 * Extracted from BoostBundleCard's own `onPay` so the exact same Razorpay wiring can also be
 * triggered automatically right after a listing is created (PostAdWizard, when a plan was
 * pre-selected on the Preview step) without duplicating it. Android/web only — iOS never opens an
 * in-app checkout for a paid digital feature (Apple Guideline 3.1.1); see PostAdWizard.tsx's own
 * comment on its iOS redirect-to-website buttons for the compliant alternative.
 */
export async function startBoostCheckout({
  accessToken,
  listingId,
  duration,
  includeInstantAlerts,
  discountCode,
}: {
  accessToken: string;
  listingId: string;
  duration: BoostDurationDays;
  includeInstantAlerts: boolean;
  discountCode?: string;
}): Promise<BoostCheckoutResult> {
  try {
    const order = await createBoostOrder(accessToken, listingId, duration, discountCode, includeInstantAlerts);

    if (order.activated) return { outcome: "activated" };

    if (!order.razorpayOrderId || !order.razorpayKeyId) {
      return { outcome: "error", message: "Couldn't open checkout — please try again." };
    }

    await RazorpayCheckout.open({
      key: order.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.razorpayOrderId,
      name: "Bhavano",
      description: `Boost this ad for ${duration} days${includeInstantAlerts ? " + Instant Alerts" : ""}`,
    });

    return { outcome: "paid" };
  } catch (e) {
    // Native SDK reports dismiss / mid-auth exit as a rejection — see razorpayNative.ts.
    if (isRazorpayUserCancel(e)) return { outcome: "cancelled" };
    return { outcome: "error", message: razorpayFailureMessage(e) };
  }
}
