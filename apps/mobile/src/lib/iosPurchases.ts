import { isAppleConsumableProductId, isAppleProductId } from "@bhavano/types/appleProducts";

/** In-App Purchase for the iOS app (App Review Guideline 3.1.1). Android and the website keep
 * Razorpay; nothing here runs off iOS. See docs/plans/ios-in-app-purchase.md.
 *
 * The flow mirrors a web checkout: ask the server what we are buying (an "intent"), run the
 * StoreKit sheet with the intent's id as the `appAccountToken`, then hand Apple's signed
 * transaction to the server to verify and fulfil. Only after the server accepts it do we tell
 * StoreKit the transaction is finished. A purchase the server did not accept stays unfinished, and
 * StoreKit replays it at the next launch, so a dropped connection never loses a paid purchase. */

export type IosPurchaseRequest =
  | { type: "subscription"; productId: string }
  | { type: "boost"; listingId: string; boostDays: 7 | 15 | 30 }
  | { type: "credits" };

export type IosPurchaseOutcome =
  | { outcome: "purchased" }
  | { outcome: "cancelled" }
  /** Apple is holding it for approval (Ask to Buy, or a payment still processing). It arrives later. */
  | { outcome: "pending" }
  | { outcome: "error"; message: string };

/** The few pieces of `expo-iap` this uses, so tests can stand in for it. */
export interface IapPurchase {
  productId: string;
  /** On iOS this is Apple's signed transaction (JWS). */
  purchaseToken?: string | null;
  appAccountToken?: string | null;
  purchaseState?: string | null;
}
export interface IapError {
  code?: string;
  message: string;
  productId?: string | null;
}
export interface IapLib {
  initConnection(): Promise<boolean>;
  fetchProducts(args: { skus: string[]; type?: "in-app" | "subs" | "all" }): Promise<
    { id?: string; displayPrice?: string }[] | null | undefined
  >;
  requestPurchase(args: unknown): Promise<unknown>;
  finishTransaction(args: { purchase: IapPurchase; isConsumable?: boolean }): Promise<unknown>;
  getAvailablePurchases(): Promise<IapPurchase[]>;
  restorePurchases(): Promise<unknown>;
  purchaseUpdatedListener(listener: (purchase: IapPurchase) => void): { remove(): void };
  purchaseErrorListener(listener: (error: IapError) => void): { remove(): void };
}

export interface IosPurchaseApi {
  createIntent(accessToken: string, request: IosPurchaseRequest): Promise<{ intentId: string; productId: string }>;
  verify(accessToken: string, signedTransaction: string): Promise<unknown>;
}

export interface IosPurchaseDeps {
  isIos: boolean;
  /** Loaded lazily: the native module only exists in iOS builds, and importing it elsewhere would crash. */
  loadIap: () => IapLib;
  api: IosPurchaseApi;
  /** Turns a thrown error into words for the user. */
  describeError?: (error: unknown) => string;
}

const NOT_IOS = "In-app purchases are only available in the iPhone app.";
const SIGN_IN = "Please sign in to complete this purchase.";

function defaultDescribe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}

export function createIosPurchaseManager(deps: IosPurchaseDeps) {
  const describe = deps.describeError ?? defaultDescribe;
  let accessToken: string | null = null;
  let started = false;
  let connection: Promise<boolean> | null = null;
  const waiting = new Map<string, (outcome: IosPurchaseOutcome) => void>();

  function lib(): IapLib {
    return deps.loadIap();
  }

  function settle(productId: string | null | undefined, outcome: IosPurchaseOutcome): void {
    // An error event does not always say which product; with exactly one purchase in flight it can only be that one.
    const key = productId && waiting.has(productId) ? productId : waiting.size === 1 ? [...waiting.keys()][0] : null;
    if (!key) return;
    const resolve = waiting.get(key);
    waiting.delete(key);
    resolve?.(outcome);
  }

  async function onPurchase(purchase: IapPurchase): Promise<void> {
    if (!isAppleProductId(purchase.productId)) return;
    if (purchase.purchaseState === "pending") {
      settle(purchase.productId, { outcome: "pending" });
      return;
    }
    if (!accessToken || !purchase.purchaseToken) {
      settle(purchase.productId, { outcome: "error", message: SIGN_IN });
      return;
    }
    try {
      await deps.api.verify(accessToken, purchase.purchaseToken);
      await lib().finishTransaction({ purchase, isConsumable: isAppleConsumableProductId(purchase.productId) });
      settle(purchase.productId, { outcome: "purchased" });
    } catch (error) {
      // Deliberately NOT finished: StoreKit keeps it and replays it at the next launch, so a purchase
      // the server could not confirm right now is retried instead of being lost.
      settle(purchase.productId, { outcome: "error", message: describe(error) });
    }
  }

  function onError(error: IapError): void {
    if (error.code === "user-cancelled") {
      settle(error.productId, { outcome: "cancelled" });
      return;
    }
    settle(error.productId, { outcome: "error", message: error.message || "The purchase could not be completed." });
  }

  /** Registers StoreKit's listeners once and connects. Safe to call repeatedly. */
  function connect(): Promise<boolean> {
    if (!deps.isIos) return Promise.resolve(false);
    if (!started) {
      started = true;
      const iap = lib();
      iap.purchaseUpdatedListener((purchase) => void onPurchase(purchase));
      iap.purchaseErrorListener(onError);
    }
    connection ??= lib()
      .initConnection()
      .then((ok) => {
        if (!ok) connection = null; // not connected: the next call tries again rather than remembering the failure
        return ok;
      })
      .catch(() => {
        connection = null;
        return false;
      });
    return connection;
  }

  return {
    /** Call when the signed-in user changes (null on sign-out). Also connects at app start, so a
     * purchase StoreKit is replaying from last time gets verified without anyone opening a sheet. */
    setAccessToken(token: string | null): void {
      accessToken = token;
      if (deps.isIos) void connect();
    },

    /** Localised store prices (`displayPrice`, e.g. "₹149.00") keyed by product id. Empty when
     * the store has none, which the UI should treat as "not purchasable right now". */
    async prices(productIds: string[]): Promise<Record<string, string>> {
      if (!deps.isIos || productIds.length === 0) return {};
      if (!(await connect())) return {};
      const products = await lib().fetchProducts({ skus: productIds, type: "all" });
      const out: Record<string, string> = {};
      for (const product of products ?? []) if (product.id && product.displayPrice) out[product.id] = product.displayPrice;
      return out;
    },

    async purchase(request: IosPurchaseRequest): Promise<IosPurchaseOutcome> {
      if (!deps.isIos) return { outcome: "error", message: NOT_IOS };
      if (!accessToken) return { outcome: "error", message: SIGN_IN };
      if (!(await connect())) return { outcome: "error", message: "The App Store isn't available right now. Please try again." };

      let intent: { intentId: string; productId: string };
      try {
        intent = await deps.api.createIntent(accessToken, request);
      } catch (error) {
        return { outcome: "error", message: describe(error) };
      }

      return new Promise<IosPurchaseOutcome>((resolve) => {
        waiting.set(intent.productId, resolve);
        const consumable = isAppleConsumableProductId(intent.productId);
        lib()
          .requestPurchase({
            request: { apple: { sku: intent.productId, appAccountToken: intent.intentId } },
            type: consumable ? "in-app" : "subs",
          })
          .catch((error: unknown) => settle(intent.productId, { outcome: "error", message: describe(error) }));
      });
    },

    /** Restore Purchases: re-checks what the Apple ID already owns and asks the server to confirm it.
     * Required for subscriptions. Safe to repeat. */
    async restore(): Promise<{ restored: number; message?: string }> {
      if (!deps.isIos) return { restored: 0, message: NOT_IOS };
      if (!accessToken) return { restored: 0, message: SIGN_IN };
      if (!(await connect())) return { restored: 0, message: "The App Store isn't available right now." };
      await lib().restorePurchases();
      const purchases = (await lib().getAvailablePurchases()) ?? [];
      let restored = 0;
      let firstError: string | undefined;
      for (const purchase of purchases) {
        if (!isAppleProductId(purchase.productId) || !purchase.purchaseToken) continue;
        try {
          await deps.api.verify(accessToken, purchase.purchaseToken);
          restored += 1;
        } catch (error) {
          firstError ??= describe(error);
        }
      }
      return restored === 0 && firstError ? { restored, message: firstError } : { restored };
    },
  };
}
