import { Platform } from "react-native";
import { BffError, createAppleIntent, verifyAppleTransaction } from "./bffClient";
import { createIosPurchaseManager, type IapLib } from "./iosPurchases";

/** The app's one iOS purchase manager, wired to the real StoreKit library and the BFF.
 *
 * `expo-iap` is required lazily, inside the function, never imported at the top of a file: the
 * native module exists only in iOS builds, and on Android (which keeps Razorpay and does not ship
 * this library's native code) merely importing it would fail. Nothing calls `loadIap` off iOS. */
export const iosPurchases = createIosPurchaseManager({
  isIos: Platform.OS === "ios",
  loadIap: () => require("expo-iap") as unknown as IapLib,
  api: {
    createIntent: createAppleIntent,
    verify: verifyAppleTransaction,
  },
  describeError: (error) =>
    error instanceof BffError ? error.userMessage : error instanceof Error ? error.message : "Something went wrong. Please try again.",
});
