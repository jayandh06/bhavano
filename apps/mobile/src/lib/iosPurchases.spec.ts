import { createIosPurchaseManager, type IapError, type IapLib, type IapPurchase } from "./iosPurchases";

const P = "com.finfolia.bhavano.";

/** A stand-in for expo-iap that lets a test fire StoreKit's events by hand. */
function makeLib() {
  const listeners: { updated?: (p: IapPurchase) => void; error?: (e: IapError) => void } = {};
  const lib = {
    initConnection: jest.fn().mockResolvedValue(true),
    fetchProducts: jest.fn().mockResolvedValue([]),
    requestPurchase: jest.fn().mockResolvedValue(undefined),
    finishTransaction: jest.fn().mockResolvedValue(undefined),
    getAvailablePurchases: jest.fn().mockResolvedValue([]),
    restorePurchases: jest.fn().mockResolvedValue(undefined),
    purchaseUpdatedListener: jest.fn((l: (p: IapPurchase) => void) => {
      listeners.updated = l;
      return { remove: jest.fn() };
    }),
    purchaseErrorListener: jest.fn((l: (e: IapError) => void) => {
      listeners.error = l;
      return { remove: jest.fn() };
    }),
  };
  return { lib: lib as unknown as IapLib & typeof lib, listeners };
}

function setup(over: { isIos?: boolean; connects?: boolean } = {}) {
  const { lib, listeners } = makeLib();
  if (over.connects === false) lib.initConnection.mockResolvedValue(false);
  const api = {
    createIntent: jest.fn().mockResolvedValue({ intentId: "intent-1", productId: `${P}plus.1m` }),
    verify: jest.fn().mockResolvedValue({ productId: `${P}plus.1m`, alreadyFulfilled: false }),
  };
  const manager = createIosPurchaseManager({ isIos: over.isIos ?? true, loadIap: () => lib, api, describeError: (e) => (e as Error).message });
  manager.setAccessToken("token");
  return { lib, listeners, api, manager };
}

/** Lets the purchase() promise start before the test fires StoreKit's event. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("iOS purchase manager: buying", () => {
  it("asks the server what to buy, runs StoreKit with the intent as appAccountToken, then verifies and finishes", async () => {
    const { lib, listeners, api, manager } = setup();

    const done = manager.purchase({ type: "subscription", productId: `${P}plus.1m` });
    await tick();

    expect(api.createIntent).toHaveBeenCalledWith("token", { type: "subscription", productId: `${P}plus.1m` });
    expect(lib.requestPurchase).toHaveBeenCalledWith({
      request: { apple: { sku: `${P}plus.1m`, appAccountToken: "intent-1" } },
      type: "subs",
    });

    listeners.updated!({ productId: `${P}plus.1m`, purchaseToken: "signed-jws", appAccountToken: "intent-1" });

    await expect(done).resolves.toEqual({ outcome: "purchased" });
    expect(api.verify).toHaveBeenCalledWith("token", "signed-jws");
    expect(lib.finishTransaction).toHaveBeenCalledWith({
      purchase: expect.objectContaining({ productId: `${P}plus.1m` }),
      isConsumable: false,
    });
  });

  it("buys a boost as a consumable and finishes it as one", async () => {
    const { lib, listeners, api, manager } = setup();
    api.createIntent.mockResolvedValue({ intentId: "intent-2", productId: `${P}boost.property.15d` });

    const done = manager.purchase({ type: "boost", listingId: "l1", boostDays: 15 });
    await tick();
    expect(lib.requestPurchase.mock.calls[0][0].type).toBe("in-app");
    listeners.updated!({ productId: `${P}boost.property.15d`, purchaseToken: "jws" });

    await expect(done).resolves.toEqual({ outcome: "purchased" });
    expect(lib.finishTransaction.mock.calls[0][0].isConsumable).toBe(true);
  });

  it("does NOT finish the transaction when the server rejects it, so StoreKit replays it later", async () => {
    const { lib, listeners, api, manager } = setup();
    api.verify.mockRejectedValue(new Error("Could not verify this purchase with Apple."));

    const done = manager.purchase({ type: "subscription", productId: `${P}plus.1m` });
    await tick();
    listeners.updated!({ productId: `${P}plus.1m`, purchaseToken: "jws" });

    await expect(done).resolves.toEqual({ outcome: "error", message: "Could not verify this purchase with Apple." });
    expect(lib.finishTransaction).not.toHaveBeenCalled();
  });

  it("reports a dismissed sheet as cancelled, and any other store error as an error", async () => {
    const a = setup();
    const cancelled = a.manager.purchase({ type: "credits" });
    await tick();
    a.listeners.error!({ code: "user-cancelled", message: "cancelled", productId: `${P}plus.1m` });
    await expect(cancelled).resolves.toEqual({ outcome: "cancelled" });

    const b = setup();
    const failed = b.manager.purchase({ type: "credits" });
    await tick();
    b.listeners.error!({ code: "network-error", message: "Network error", productId: `${P}plus.1m` });
    await expect(failed).resolves.toEqual({ outcome: "error", message: "Network error" });
  });

  it("reports a purchase Apple is holding for approval as pending", async () => {
    const { listeners, manager } = setup();
    const done = manager.purchase({ type: "subscription", productId: `${P}plus.1m` });
    await tick();
    listeners.updated!({ productId: `${P}plus.1m`, purchaseState: "pending" });
    await expect(done).resolves.toEqual({ outcome: "pending" });
  });

  it("fails cleanly when the server will not create the order", async () => {
    const { lib, api, manager } = setup();
    api.createIntent.mockRejectedValue(new Error("You don't own this listing"));

    await expect(manager.purchase({ type: "boost", listingId: "l1", boostDays: 7 })).resolves.toEqual({
      outcome: "error",
      message: "You don't own this listing",
    });
    expect(lib.requestPurchase).not.toHaveBeenCalled();
  });

  it("will not start without a signed-in user, off iOS, or when the store cannot connect", async () => {
    const signedOut = setup();
    signedOut.manager.setAccessToken(null);
    expect((await signedOut.manager.purchase({ type: "credits" })).outcome).toBe("error");
    expect(signedOut.api.createIntent).not.toHaveBeenCalled();

    const android = setup({ isIos: false });
    expect(await android.manager.purchase({ type: "credits" })).toEqual({ outcome: "error", message: expect.stringMatching(/iPhone/) });
    expect(android.lib.initConnection).not.toHaveBeenCalled();
    expect(android.lib.purchaseUpdatedListener).not.toHaveBeenCalled();

    const offline = setup({ connects: false });
    expect((await offline.manager.purchase({ type: "credits" })).outcome).toBe("error");
    expect(offline.api.createIntent).not.toHaveBeenCalled();

    // A failed connection is not remembered: once the store is reachable the next purchase works.
    offline.lib.initConnection.mockResolvedValue(true);
    const retry = offline.manager.purchase({ type: "credits" });
    await tick();
    expect(offline.api.createIntent).toHaveBeenCalled();
    void retry;
  });
});

describe("iOS purchase manager: replaying and restoring", () => {
  it("verifies and finishes a purchase StoreKit replays at launch, with no sheet open", async () => {
    const { lib, listeners, api } = setup();
    await tick();

    listeners.updated!({ productId: `${P}credits.pack`, purchaseToken: "old-jws" });
    await tick();

    expect(api.verify).toHaveBeenCalledWith("token", "old-jws");
    expect(lib.finishTransaction).toHaveBeenCalledWith(expect.objectContaining({ isConsumable: true }));
  });

  it("ignores transactions for products that are not ours", async () => {
    const { lib, listeners, api } = setup();
    await tick();
    listeners.updated!({ productId: "com.other.app.thing", purchaseToken: "x" });
    await tick();
    expect(api.verify).not.toHaveBeenCalled();
    expect(lib.finishTransaction).not.toHaveBeenCalled();
  });

  it("restores by asking the server to confirm each owned Bhavano product", async () => {
    const { lib, api, manager } = setup();
    lib.getAvailablePurchases.mockResolvedValue([
      { productId: `${P}plus.12m`, purchaseToken: "a" },
      { productId: "com.other.app.thing", purchaseToken: "b" },
      { productId: `${P}agentpro.1m`, purchaseToken: "c" },
    ]);

    await expect(manager.restore()).resolves.toEqual({ restored: 2 });
    expect(lib.restorePurchases).toHaveBeenCalled();
    expect(api.verify).toHaveBeenCalledTimes(2);
  });

  it("explains a restore that confirmed nothing because of an error", async () => {
    const { lib, api, manager } = setup();
    lib.getAvailablePurchases.mockResolvedValue([{ productId: `${P}plus.1m`, purchaseToken: "a" }]);
    api.verify.mockRejectedValue(new Error("This purchase belongs to a different account."));

    await expect(manager.restore()).resolves.toEqual({ restored: 0, message: "This purchase belongs to a different account." });
  });
});

describe("iOS purchase manager: prices", () => {
  it("returns the store's own localised price for each product", async () => {
    const { lib, manager } = setup();
    lib.fetchProducts.mockResolvedValue([
      { id: `${P}plus.1m`, displayPrice: "₹99.00" },
      { id: `${P}plus.6m`, displayPrice: "₹549.00" },
      { id: `${P}plus.12m` },
    ]);

    await expect(manager.prices([`${P}plus.1m`, `${P}plus.6m`, `${P}plus.12m`])).resolves.toEqual({
      [`${P}plus.1m`]: "₹99.00",
      [`${P}plus.6m`]: "₹549.00",
    });
    expect(lib.fetchProducts).toHaveBeenCalledWith({ skus: [`${P}plus.1m`, `${P}plus.6m`, `${P}plus.12m`], type: "all" });
  });

  it("returns nothing off iOS or for an empty list", async () => {
    expect(await setup({ isIos: false }).manager.prices([`${P}plus.1m`])).toEqual({});
    expect(await setup().manager.prices([])).toEqual({});
  });
});
