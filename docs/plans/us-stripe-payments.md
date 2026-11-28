# US payments with an Indian company (Razorpay or Stripe India)

## Status: Razorpay chosen and its code built 2026-11-28; US payments are still switched off

Part of [us-market-expansion.md](us-market-expansion.md). Today the US sells nothing (`paymentsEnabled: false`) and India uses
Razorpay (website, Android) and Apple In-App Purchase (iPhone). India's behaviour does not change.

**Decided 2026-11-28:** no US company. Finfolia Technologies LLP charges US buyers. A US Stripe account is therefore out, which
leaves two providers.

## Which provider

| | Razorpay international payments | Stripe India |
|---|---|---|
| Getting in | Turn on in the existing dashboard; banking partners approve | Sign-up is invite-only; no waiting time stated. LLPs are allowed |
| Charges and payout | US cards in dollars, paid out in rupees | US cards in dollars, paid out in rupees |
| Each payment needs | Nothing extra found; confirm at activation | Buyer's name, billing address and a description; 3-D Secure |
| Account set-up | Refund and shipping policy pages | LLP papers, one transaction purpose code |
| Code | Small: currency and settings | A second payment system: database change, new webhook, new checkout |
| Fee | 3% plus taxes per card payment | India international-card fee: confirm with Stripe (its India page showed 3%) |

**Chosen 2026-11-28: Razorpay.** With an Indian company both look the same to a US buyer and both pay out in rupees. Razorpay is already
built in, so it is much less work and needs no invite. Choose Stripe India only for a reason Razorpay cannot meet, and ask for the
invite before building.

## What the owner does (Claude cannot)
1. Razorpay: turn on International payments (Account & Settings), and answer the bank's questions. Or request the Stripe invite.
2. Ask the accountant: GST on services sold abroad, the paperwork for money received from abroad, and US sales tax.
3. Approve a refund policy.
4. Put the keys and webhook secret into the US server's `.env`. Never in chat or the repository.
5. Add the US webhook address, `https://api.us.bhavano.com/payments/webhook`, in the provider's dashboard.

## Design: common to both
- `appPaymentsEnabled` market setting: India `true`, US `false`. The app reads it; the website and server keep `paymentsEnabled`. The
  US website can then sell while the apps offer nothing. App requests (`X-Client: app`) keep getting no upgrade offer from the server
  while it is false.
- Currency comes from the market. `'INR'` is written directly throughout `payments.service.ts` today.
- Dollar defaults already exist for Feature, instant alerts, plans and contact credits; the owner confirms them. Listing fees default
  to zero.
- Refund and shipping policy pages; the US Terms name Finfolia Technologies LLP as the seller.
- Check emails, notifications, receipts and purchase history for rupee wording.
- Referral rewards switch on with payments.

## Design: Razorpay (recommended)
- No database change: `Payment.currency` exists, and cents work as paise do (amount times 100).
- US server gets the Razorpay settings in `.env.us.example` and `docker-compose.us.yml`.
- The website's Razorpay pop-up is reused as it is.
- Both servers' webhook addresses sit on one account. A server already ignores an order it does not know; confirm in test mode that
  India's and the US's orders do not interfere.

## Design: Stripe India (only if chosen)
- Market setting `paymentProvider`: India `razorpay`, US `stripe`.
- Additive migration on both databases: `PaymentProvider` gains `stripe`; `Payment` gains optional unique
  `stripeCheckoutSessionId` and `stripePaymentIntentId`; `razorpayOrderId` holds a placeholder, as Apple rows do.
- One "open a checkout" helper replaces the direct `orders.create` calls. The US uses Stripe's hosted Checkout page, collecting name
  and billing address. Confirm Checkout is available to India accounts.
- New `POST /payments/stripe/webhook`: verify the signature; fulfil on `checkout.session.completed` unless unpaid, and on
  `async_payment_succeeded`; claim the row with one conditional update so repeat deliveries grant once.
- Returning from Stripe goes to My listings, which shows "activating" until the server says paid.

## Apps
Left without offers. Selling inside the apps falls under Apple's and Google's rules, which have been changing in the US; read both
current policies before designing that phase.

## Phases
| Phase | Work | Needs |
|---|---|---|
| 0 | International payments approval (or Stripe invite), accountant | Owner |
| 1 | Server and website changes, tests. US stays switched off | Nothing |
| 2 | Test-mode run on the US site | Test keys |
| 3 | Live keys, switch US payments on | Approval, refund policy, tax decisions |
| 4 | Apps | Store policy check |

## Checks
- India still creates orders in rupees, and its webhook is unchanged.
- The US creates orders in dollars; a bad signature is refused; a repeated delivery grants once.
- Switched off, the US refuses to open a checkout.

## Built 2026-11-28 (phase 1)

- `appPaymentsEnabled` (India on, US off). The apps read the market through `appMarket`, so switching US payments on does not make the
  apps offer anything. `entitlementFor` now takes whether the caller sells, not a market.
- The server charges in the market's currency; India's orders are unchanged. The posted-reminder push follows what the apps sell.
- US server settings for the Razorpay key, secret and webhook secret (`docker-compose.us.yml`, `.env.us.example`).
- Dollar copies of the two Featured promotion emails (`notification-templates/us/email/boost-promotion*`).
- Refund and delivery wording drafted for approval: [refund-and-delivery-policy-draft.md](refund-and-delivery-policy-draft.md). The
  pages are not built.

Not run against Razorpay: no order has been created in dollars with real or test keys.

## Switching the US on (after approval, keys and the pages)
1. Build the refund and delivery pages from the approved wording.
2. Update the US Terms, which say the site is free to use, with the payment and refund terms.
3. Confirm the prices in the US admin. Keep US listing fees at zero while the apps cannot pay: a fee would hold ads posted in an app.
4. Keep the Featured nudge messages off in the US until the apps sell: an app shows them as plain text offering Featured.
5. Set `paymentsEnabled: true` for the US in `packages/types/src/market.ts`, update the tests that expect it off, and deploy.

## Open questions
1. Refunds: do they remove the Feature or credits? (Today a refund changes nothing in India either.)
2. Which prices go live?

## Sources (read 2026-11-28)
- [Razorpay international payments FAQ](https://razorpay.com/docs/us/payments/international-payments/faqs)
- [Razorpay international cards](https://razorpay.com/docs/us/payments/international-payments/international-debit-credit-cards)
- [Razorpay international pricing](https://razorpay.com/accept-international-payments/)
- [Stripe India FAQ](https://support.stripe.com/questions/india-faq)
- [Opening a Stripe account in India](https://support.stripe.com/questions/how-can-i-open-a-stripe-account-in-india)
- [Stripe India: international payments](https://docs.stripe.com/india-accept-international-payments)
