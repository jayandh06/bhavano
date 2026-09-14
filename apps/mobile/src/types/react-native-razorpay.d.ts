/** react-native-razorpay ships no root-level type declarations (only a sample-app one, not
 * usable as a package types entry) — this covers only the surface actually used here. See
 * https://github.com/razorpay/react-native-razorpay. */
declare module "react-native-razorpay" {
  export interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name?: string;
    description?: string;
    image?: string;
    prefill?: { email?: string; contact?: string; name?: string };
    theme?: { color?: string };
  }

  export interface RazorpayCheckoutSuccess {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  /** Rejects with this shape both on a real failure and on the user dismissing the sheet
   * (code 0 / "Payment Cancelled" — see BoostModal's own handling). */
  export interface RazorpayCheckoutError {
    code: number;
    description: string;
  }

  export default class RazorpayCheckout {
    static open(options: RazorpayCheckoutOptions): Promise<RazorpayCheckoutSuccess>;
  }
}
