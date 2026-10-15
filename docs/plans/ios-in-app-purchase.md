# In-App Purchase for the iOS app only

## Status: server and app built (2026-10-16); not yet testable against Apple

Built and unit-tested, but **never exercised against the real App Store**: that needs the App
Store Connect setup below, a development build on a physical device, and a sandbox tester.

| Piece | Where |
|---|---|
| Shared product ids (the contract with App Store Connect) | `packages/types/src/appleProducts.ts` |
| Server: intent, verify, notifications | `apps/bff/src/payments/apple/` (+ migration `20261015120000_apple_in_app_purchase`) |
| Shared fulfilment (Razorpay webhook and Apple both call it) | `PaymentsService.fulfilPaidPayment` |
| App: purchase manager | `apps/mobile/src/lib/iosPurchases.ts` (+ `iosPurchasesClient.ts`) |
| App: purchase sheets | `apps/mobile/src/components/home/IosPurchaseSheets.tsx` |
| iOS branches | plans, boost button, boost offer card, posting wizard, account credits, listing "View contact", my listings |
| Build config | `expo-iap` plugin and iOS 16.4 target for iOS builds only; excluded from Android autolinking |

Server verification needs **no secret**: it checks Apple's signature against Apple's public root
certificates (bundled). The App Store Connect API/In-App Purchase `.p8` key is only for calling
Apple's server API (not used yet), so step 3 under "What only you can do" is not needed for v1.

What the app does NOT sell on iOS in v1, and what happens instead: the listing publish fee and
Instant Alerts on their own (the fee defaults to 0, so no iOS user is blocked today; if an admin
turns one on, iOS shows "needs a payment that can't be made in the iPhone app" and never links to
the website).

Known gaps: refunded consumables are recorded but their benefit is not reversed (logged for a human
to review); there is no `GET` for Apple purchase history beyond the existing `/purchases` list;
boosts ignore the web's per-listing-value price bands (flat tiers only).

## Original plan

**Trigger.** 2026-10-15, App Review rejected build 1.0.1 (21) under **Guideline 3.1.1**: "the
subscription plans can be purchased in the app using payment mechanisms other than In-App
Purchase." Our iOS build shows plan prices with "Choose …" buttons that open the website's
`/premium` in an in-app browser, which Apple treats as a call to action toward an outside payment.
`ios-app-store-release.md` recorded this risk in advance ("a workaround, not a resolution").

**Decision (2026-10-15):** build Apple In-App Purchase, **for iOS only**. Android and the website
keep Razorpay exactly as they are.

## What Apple requires

- Digital goods and services bought in the iOS app (subscriptions, boosts, credits, a publish fee)
  must use IAP. Apple takes 15% (Small Business Program, if eligible) or 30%.
- The iOS app must not carry buttons, links or prices that steer people to pay elsewhere. The
  current "open the website" buttons have to go on iOS even after IAP exists.
- Access bought elsewhere (web, Android) may still be used in the iOS app.
- Subscriptions need a **Restore Purchases** button and the auto-renewal disclosure (price, period,
  that it renews, links to Terms and Privacy) shown before purchase (Guideline 3.1.2).

## Where the iOS app sells things today (all must change)

| Surface | File | Today on iOS |
|---|---|---|
| Plans screen | `app/plans.tsx` | prices + "Choose …" opens `/premium` |
| Boost button | `components/home/BoostButton.tsx` | opens web boost checkout |
| Boost offer card (messages) | `components/home/BoostOfferMessageCard.tsx` | opens web |
| Boost after posting | `components/home/PostAdWizard.tsx` | opens web |
| Publish fee | `app/my-listings/index.tsx` | "Complete payment on website" |
| Contact reveal credits | `app/(tabs)/account.tsx`, listing detail | opens web |
| "Plans" menu entries | `HomeDrawer.tsx`, `UtilityBar.tsx` | open web |

## The product catalogue is the real design problem

Today prices are **admin-editable and dynamic** (per category, per duration, per unit, with
discount codes and referral credits). IAP prices are **fixed products with Apple price points**
chosen in App Store Connect. So iOS gets a fixed catalogue; admin price edits stop applying to iOS
until the product is changed in App Store Connect.

Proposed catalogue, from the current default settings (rupee amounts are the web prices today, not
final iOS prices: Apple's cut means iOS prices normally sit higher, which is a pricing decision):

| Product | Type | Web price today |
|---|---|---|
| Bhavano Plus, 1 month | auto-renewable subscription | ₹99 |
| Bhavano Plus, 6 months | auto-renewable subscription | ₹549 |
| Bhavano Plus, 12 months | auto-renewable subscription | ₹899 |
| Seller slot pack, monthly | auto-renewable subscription | ₹149 |
| Agent/Broker Pro, monthly (1 unit) | auto-renewable subscription | ₹499 per unit |
| Boost 7 / 15 / 30 days, property | consumable | ₹199 / 349 / 599 |
| Boost 7 / 15 / 30 days, coworking, PG, storage | consumable | ₹99 / 179 / 299 |
| Instant Alerts | consumable | from settings |
| Contact reveal credits pack | consumable | from settings |
| Listing publish fee | consumable | from settings |

Not translatable and dropped on iOS: **multi-unit Agent Pro** (IAP has no quantity; v1 sells one
unit), **discount codes** and **referral credits** (Apple promotional offers are a separate
mechanism), furniture and interiors boosts (those categories are paused).

## Design

**Library.** `expo-iap` (StoreKit 2, development build required, not Expo Go). RevenueCat is the
alternative: it takes over receipt validation and renewals but adds a third-party processor and
maps poorly to "this boost belongs to this listing". Verify the current `expo-iap` and Expo SDK 57
docs before writing code; `apps/mobile/AGENTS.md` requires reading the versioned docs first.

**Flow (mirrors the Razorpay order flow).**
1. App asks the server for a purchase **intent**: `POST /payments/apple/intent {type, listingId?, …}`.
   The server validates it (ownership, eligibility, which product), stores it, and returns a UUID
   and the product id.
2. App starts the StoreKit purchase with that UUID as the `appAccountToken`.
3. App sends the signed transaction to `POST /payments/apple/verify`. The server verifies the JWS
   with Apple's official server library (`@apple/app-store-server-library`) against Apple's root
   certificates, matches `appAccountToken` to the intent, and **fulfils through the same
   activation code as Razorpay** (`activateListingBoost`, `activateInstantAlerts`, the subscription
   grants, credit grants). Only then does the app finish the transaction.
4. **Idempotency:** a unique `transactionId` / `originalTransactionId` record, so a retried verify
   or a replayed notification can never grant twice.
5. **Renewals, cancellations, refunds:** App Store Server Notifications V2 to
   `POST /payments/apple/notifications`, verified the same way, extend or end the subscription and
   reverse refunded consumables.

**Schema.** An `ApplePurchaseIntent` and `AppleTransaction` table, and `apple` as a payment provider
on the existing payment record so purchase history (`/purchases`) lists both kinds.

**Client.** A `useIosPurchase` hook behind `Platform.OS === "ios"`; the plans, boost, publish and
credits surfaces each get an iOS branch that shows the StoreKit-localised price (`displayPrice`),
the subscription disclosure, and Restore Purchases. Android and web branches stay as they are.

## What only you can do (Apple side)

1. Accept the **Paid Applications Agreement** and complete bank and tax details in App Store Connect.
2. Create the products above (and the subscription group and its localisations) with their price
   points. Product ids are the contract between app and server.
3. Create an **In-App Purchase key** (a separate key type from the App Store Connect API key used
   for `eas submit`) and note the key id and issuer id. The server needs the `.p8`.
4. Set the **App Store Server Notifications** URL (production and sandbox) to the server endpoint.
5. Create **sandbox testers**, and enrol in the Small Business Program if eligible.
6. Add the products to the app version and submit them with the build. First-time IAP products are
   reviewed with the binary.

## Phases

1. **Decisions and Apple setup** (you): the catalogue and iOS prices, items above.
2. **Server:** schema, intent, verify, notifications, fulfilment reuse; unit tests with a mocked
   Apple verifier. Cannot be tested against real Apple until step 2 above exists.
3. **App:** `expo-iap`, development build, the purchase hook and the iOS branches, removal of the
   iOS link-outs.
4. **Sandbox and TestFlight testing** on a physical device, then resubmit with review notes
   explaining the IAP products and how the reviewer can test them.

This is a multi-week piece of work: most of the time is the Apple setup, device testing and App
Review of the IAP products, not the code.

## Interim option (recommended alongside this)

Ship an iOS build that **hides every price and web link-out** (iOS shows only what the account
already has) so the app can be approved now, and add IAP behind it as it is finished. It is about a
day of work, and it avoids sitting in rejection for the weeks IAP takes. Not decided yet.

## Open decisions

- Which products are in v1, and the iOS price points (Apple's commission means iOS prices normally
  differ from web).
- Drop multi-unit Agent Pro and discount codes on iOS?
- `expo-iap` (direct StoreKit 2, our own server verification) or RevenueCat?
- Do the interim "hide purchasing" release first?
