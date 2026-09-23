import type { BoostPlanSelection } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { createListingPublishOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "./razorpay";
import { pushDataLayerEvent } from "./gtm";

export type ListingPublishCheckoutResult =
  | { outcome: "activated" }
  | { outcome: "paid" }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

export async function startListingPublishCheckout({
  listingId,
  category,
  boostSelection,
}: {
  listingId: string;
  category: string;
  boostSelection: BoostPlanSelection | null;
}): Promise<ListingPublishCheckoutResult> {
  const result = await createListingPublishOrderAction(
    listingId,
    boostSelection?.duration,
    boostSelection?.includeInstantAlerts,
  );
  if (!result.success) return { outcome: "error", message: result.error };

  if (result.order.activated) return { outcome: "activated" };

  if (!result.order.razorpayOrderId || !result.order.razorpayKeyId) {
    return { outcome: "error", message: "Couldn't open checkout — please try again." };
  }

  const { order } = result;
  pushDataLayerEvent("begin_checkout_listing_publish", {
    transactionId: order.paymentId,
    listingId,
    category,
    boostDays: boostSelection?.duration,
    includeInstantAlerts: boostSelection?.includeInstantAlerts,
    value: order.amount / 100,
    currency: order.currency,
  });

  try {
    await loadRazorpayScript();
    return await new Promise<ListingPublishCheckoutResult>((resolve) => {
      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId!,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId!,
        name: "Bhavano",
        description: "Publish your ad",
        handler: () => {
          pushDataLayerEvent("listing_publish_purchase", {
            transactionId: order.paymentId,
            listingId,
            category,
            boostDays: boostSelection?.duration as BoostDurationDays | undefined,
            includeInstantAlerts: boostSelection?.includeInstantAlerts,
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
