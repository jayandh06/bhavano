import RazorpayCheckout from "react-native-razorpay";
import type { BoostPlanSelection } from "@bhavano/types";
import { ACTIVE_PROMO_CODE } from "@bhavano/types/promoCode";
import { createListingPublishOrder } from "./bffClient";

export type ListingPublishCheckoutResult =
  | { outcome: "activated" }
  | { outcome: "paid" }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

export async function startListingPublishCheckout({
  accessToken,
  listingId,
  boostSelection,
}: {
  accessToken: string;
  listingId: string;
  boostSelection: BoostPlanSelection | null;
}): Promise<ListingPublishCheckoutResult> {
  try {
    const order = await createListingPublishOrder(
      accessToken,
      listingId,
      boostSelection?.duration,
      boostSelection?.includeInstantAlerts,
      ACTIVE_PROMO_CODE,
    );

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
      description: "Publish your ad",
    });

    return { outcome: "paid" };
  } catch (e) {
    const err = e as { description?: string };
    const isCancel = err.description?.toLowerCase().includes("cancel");
    return isCancel ? { outcome: "cancelled" } : { outcome: "error", message: err.description || "Payment failed — please try again." };
  }
}
