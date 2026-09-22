import type { ListingCategory } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { createBoostBundleOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "./razorpay";
import { pushDataLayerEvent } from "./gtm";

export type BoostCheckoutResult =
  | { outcome: "activated" }
  | { outcome: "paid" }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

/**
 * Extracted from BoostBundlePicker's own `onPay` so the exact same order-creation + Razorpay
 * wiring (GTM events included) can also be triggered automatically right after a listing is
 * created (PostAdWizard, when a plan was pre-selected on the Preview step) without duplicating it.
 */
export async function startBoostCheckout({
  listingId,
  category,
  duration,
  includeInstantAlerts,
}: {
  listingId: string;
  category: ListingCategory;
  duration: BoostDurationDays;
  includeInstantAlerts: boolean;
}): Promise<BoostCheckoutResult> {
  const result = await createBoostBundleOrderAction(listingId, duration, includeInstantAlerts);
  if (!result.success) return { outcome: "error", message: result.error };

  if (result.order.activated) return { outcome: "activated" };

  if (!result.order.razorpayOrderId || !result.order.razorpayKeyId) {
    return { outcome: "error", message: "Couldn't open checkout — please try again." };
  }

  const { order } = result;
  pushDataLayerEvent("begin_checkout_boost", {
    transactionId: order.paymentId,
    listingId,
    category,
    boostDays: duration,
    includeInstantAlerts,
    value: order.amount / 100,
    currency: order.currency,
  });

  try {
    await loadRazorpayScript();
    return await new Promise<BoostCheckoutResult>((resolve) => {
      const razorpay = new window.Razorpay({
        // Both non-null by the guard above — same pattern BoostProvider uses.
        key: order.razorpayKeyId!,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId!,
        name: "Bhavano",
        description: `Boost this ad for ${duration} days${includeInstantAlerts ? " + Instant Alerts" : ""}`,
        handler: () => {
          pushDataLayerEvent("boost_purchase", {
            transactionId: order.paymentId,
            listingId,
            category,
            boostDays: duration,
            includeInstantAlerts,
            value: order.amount / 100,
            currency: order.currency,
          });
          resolve({ outcome: "paid" });
        },
        modal: { ondismiss: () => resolve({ outcome: "cancelled" }) },
      });
      razorpay.open();
    });
  } catch {
    return { outcome: "error", message: "Couldn't open checkout — please try again." };
  }
}
