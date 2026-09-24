import { isRazorpayUserCancel, razorpayFailureMessage } from "./razorpayNative";

describe("isRazorpayUserCancel", () => {
  it("treats an explicit cancel description as cancel", () => {
    expect(isRazorpayUserCancel({ description: "Payment Cancelled" })).toBe(true);
  });

  it("treats mid-auth customer exit (BAD_REQUEST payment_authentication) as cancel", () => {
    expect(
      isRazorpayUserCancel({
        description: JSON.stringify({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "undefined",
            source: "customer",
            step: "payment_authentication",
            reason: "payment_error",
            metadata: {},
          },
        }),
      }),
    ).toBe(true);
  });

  it("does not treat an unrelated failure as cancel", () => {
    expect(
      isRazorpayUserCancel({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Payment failed",
          source: "gateway",
          step: "payment_initiation",
          reason: "payment_error",
        },
      }),
    ).toBe(false);
  });
});

describe("razorpayFailureMessage", () => {
  it("never returns raw JSON or the literal undefined string", () => {
    expect(
      razorpayFailureMessage({
        description: JSON.stringify({
          error: { code: "BAD_REQUEST_ERROR", description: "undefined", source: "gateway" },
        }),
      }),
    ).toBe("Payment failed — please try again.");
  });

  it("keeps a real human-readable description", () => {
    expect(razorpayFailureMessage({ description: "Card declined" })).toBe("Card declined");
  });
});
