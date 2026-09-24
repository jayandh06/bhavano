/**
 * react-native-razorpay has no clean "user cancelled" callback the way web's
 * `modal.ondismiss` does — dismiss, back, and mid-auth exit all arrive as Promise
 * rejections. The payload shape varies by OS and checkout step; this normalizes it
 * so callers can hide cancel from the user and never paint raw SDK JSON under a card.
 */

type RazorpayInnerError = {
  code?: string;
  description?: string;
  source?: string;
  step?: string;
  reason?: string;
};

type RazorpayNativeError = {
  code?: number | string;
  description?: string;
  message?: string;
  error?: RazorpayInnerError;
};

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function normalizeRazorpayError(e: unknown): RazorpayNativeError {
  if (e == null) return {};
  if (typeof e === "string") {
    const parsed = tryParseJson(e);
    if (parsed && typeof parsed === "object") return normalizeRazorpayError(parsed);
    return { description: e };
  }
  if (typeof e !== "object") return { description: String(e) };

  const obj = e as RazorpayNativeError;
  // Android often stuffs the whole `{ error: {...} }` blob into `description` as a string.
  if (typeof obj.description === "string" && obj.description.trim().startsWith("{")) {
    const nested = tryParseJson(obj.description);
    if (nested && typeof nested === "object") {
      const nestObj = nested as RazorpayNativeError;
      return {
        ...obj,
        error: nestObj.error ?? obj.error,
        description: nestObj.error?.description ?? nestObj.description ?? obj.description,
      };
    }
  }
  return obj;
}

/** True when the seeker closed checkout / backed out without a completed payment. */
export function isRazorpayUserCancel(e: unknown): boolean {
  const err = normalizeRazorpayError(e);
  const texts = [err.description, err.message, err.error?.description, err.error?.reason]
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .map((t) => t.toLowerCase());

  if (texts.some((t) => t.includes("cancel") || t.includes("dismiss") || t.includes("back pressed"))) {
    return true;
  }

  // Closing during UPI/OTP/card auth: SDK returns BAD_REQUEST_ERROR with
  // source=customer, step=payment_authentication, and description literally "undefined".
  // No money moved — treat as cancel so we don't dump that JSON under the boost card.
  if (err.error?.source === "customer" && err.error?.step === "payment_authentication") {
    return true;
  }

  return false;
}

/** Safe copy for a real payment failure — never the raw SDK object / `"undefined"`. */
export function razorpayFailureMessage(e: unknown): string {
  const err = normalizeRazorpayError(e);
  const desc = err.error?.description ?? err.description ?? err.message;
  if (
    typeof desc === "string" &&
    desc.trim() &&
    desc.trim().toLowerCase() !== "undefined" &&
    !desc.trim().startsWith("{")
  ) {
    return desc;
  }
  return "Payment failed — please try again.";
}
