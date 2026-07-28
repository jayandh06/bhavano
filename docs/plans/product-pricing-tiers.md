# Bhavano product pricing tiers (sellers, brokers, buyers)

Canonical summary of subscription and pay-per-use products as agreed in product discussions
(July 2026). Implementation details for seller slot caps and notifications:
`docs/plans/listing-slots-seller-notifications.md`. Boost mechanics:
`docs/plans/monetization-boosted-listings-premium-tiers.md`.

**Shared rules**

- **Slots** = how many **active** listings you can have **at the same time** (approved/active,
  not expired). When one expires or you remove it, the slot frees up. There is **no** daily
  “posts per 24 hours” limit.
- **Boost** = paid **visibility** on **one** listing for 7 or 15 days (Featured badge, top
  rotation). Separate from slot subscriptions. Everyone pays per boost unless a Pro boost credit
  applies.

---

## 1. Individual sellers (owners, landlords, casual sellers)

Not agents running a business storefront — typically ≤10 live ads.

### 1.1 Free — ₹0

| | |
|--|--|
| **Price** | Free |
| **Concurrent listings** | **5** active at once |
| **Listing lifetime** | Default **30 days** per ad (`expiresAt`); then ad drops from browse and slot frees |
| **Photos / video** | Standard limits (e.g. 1 video × 30s — see `videoLimits.ts`) |
| **Public storefront** | `/agent/[userId]` may show all active listings; **no** “Bhavano Pro” badge |
| **Boost** | Optional, pay per listing (see §4) |

**Best for:** Selling one home, a few items, occasional landlord with a handful of units.

### 1.2 Seller slot pack — **₹149 / month**

| | |
|--|--|
| **Price** | **₹149/month** (monthly subscription; tier id TBD e.g. `sellerSlotPack`) |
| **Concurrent listings** | **10** total (**5 free + 5 extra**) |
| **Includes** | Higher inventory cap only |
| **Does not include** | Pro badge, agent storefront marketing perks, elevated video tier, included boosts |
| **Stacks with Pro?** | No — if user has active **Agent Pro**, Pro slot allowance **replaces** this (whichever is higher) |

**Best for:** Individual with 6–10 things to list at once (multiple flats, PG rooms, furniture lots).

### 1.3 Boost (optional add-on) — per listing

Any individual seller can boost **any owned** listing from **My listings** — not bundled with
free or ₹149 pack.

See **§4 Boost pricing** (category-tiered).

**Best for:** “This one ad needs more leads this week.”

---

## 2. Broker / agent sellers

Professionals posting inventory at scale; need brand and more slots.

### 2.1 Agent / Broker Pro — **₹499 / month** (per 20 slots)

| | |
|--|--|
| **Price** | **₹499/month** per **20 concurrent listing slots** |
| **Scaling** | Each additional **₹499/month** adds **+20 slots** (e.g. 40 slots = ₹998/mo, 60 = ₹1,497/mo) |
| **Concurrent listings** | **20 × units** purchased (while subscription active) |
| **Storefront** | Public **`/agent/[userId]`** — all active listings, member since, listing grid |
| **Badge** | **“✓ Bhavano Pro”** on storefront (and marketing: Pro identity) |
| **Video** | **Elevated** posting limits (e.g. **3 videos × 120s** per listing when posting) |
| **Monthly sweetener** | **One 7-day boost credit** per calendar month (one listing; redeem via boost flow) |
| **Extra boosts** | **Full price** per additional listing / duration (§4) — not unlimited featured ads |

**Best for:** Brokers, property consultants, PG operators, commercial agents with steady inventory.

### 2.2 Boost (ongoing) — per listing

Same as individuals: pay to feature specific listings beyond the monthly credit.

### 2.3 What brokers do **not** get by default

- Unlimited concurrent listings (capped by paid units × 20).
- Unlimited boosts (only **1× 7-day credit/month** included).
- Buyer-side Bhavano Plus features (separate subscription if they also rent/buy).

---

## 3. Buyers & renters — **Bhavano Plus**

Subscription for people **searching**, not for posting inventory.

| Term | Price | Effective / month | Notes |
|------|-------|-------------------|--------|
| **1 month** | **₹99** | ₹99 | Try while actively hunting |
| **6 months** | **₹549** | ~₹92 | Fits typical rent-search window |
| **12 months** | **₹899** | ~₹75 | Best value (~24% off vs 12× monthly) |

**Tier id:** `buyerPremium` (“Bhavano Plus” on `/premium`).

### 3.1 Included benefits

| Benefit | Description |
|---------|-------------|
| **Early-access alerts** | Saved-search notifications when a **new** matching listing goes live (ahead of casual browsers where implemented) |
| **Verified Buyer badge** | **“✓ Verified Buyer”** shown to sellers on messages you send |
| **Inbox priority** | Higher visibility in sellers’ message inboxes vs free buyers (where implemented) |

### 3.2 Not included

- Extra listing slots (buyers use free **5** slots only if they also post as sellers).
- Agent Pro / storefront / Pro badge.
- Listing boosts (seller product).

**Best for:** Renters and buyers in competitive markets who want alerts and seller attention.

---

## 4. Boost pricing (all sellers — individual & broker)

Pay **per listing**, **7 or 15 days**. Prices in **INR** (Razorpay charges paise).

| Category tier | Categories | 7 days | 15 days |
|---------------|------------|--------|---------|
| **High-value** | house, apartment, villa, plot, commercial | **₹199** | **₹349** |
| **Mid-value** | coworking, pg, storage | **₹99** | **₹179** |
| **Low-value** | furniture, interiors | **₹49** | **₹89** |

**Effects:** Featured badge, boosted sort / rotation at top of results (see boost rotation job).

**Pro credit:** Agent Pro subscribers get **one 7-day boost per month** on one listing; further
boosts at table prices.

Source: `packages/types/src/boostPricing.ts`.

---

## 5. Quick comparison table

| | **Free seller** | **Seller pack ₹149/mo** | **Agent Pro ₹499/mo** | **Bhavano Plus (buyer)** |
|--|-----------------|-------------------------|-------------------------|---------------------------|
| **Who** | Individual | Individual | Broker / agent | Buyer / renter |
| **Live listings** | 5 | 10 | 20 (+₹499 per +20) | N/A (post as free seller if needed) |
| **Storefront + Pro badge** | No | No | Yes | No |
| **Elevated video** | No | No | Yes | No |
| **Included boost** | None | None | 1× 7-day / month | None |
| **Paid boost** | Optional | Optional | Optional | N/A |
| **Alerts / Verified Buyer** | No | No | No | Yes |

---

## 6. Where to buy (product surfaces)

| Product | Surface |
|---------|---------|
| Bhavano Plus | `/premium` → Subscribe |
| Agent Pro | `/premium` → Subscribe |
| Seller slot pack | `/premium` (planned) + cap modal on post / my-listings |
| Boost | `/my-listings`, post success step |

---

## 7. Implementation status (codebase snapshot)

| Product | Status |
|---------|--------|
| Boost | Implemented |
| Bhavano Plus ₹99 / ₹549 / ₹899 | Implemented (`subscriptionPricing.ts`) |
| Agent Pro ₹499 | Implemented (today: unlimited **publish rate**, not slot cap — migrate per slots plan) |
| Seller pack ₹149 | Planned |
| Slot caps (5 / 10 / 20) | Planned |
| Expiry reminders & weekly digest | Planned |

When seller slot caps ship, update `subscriptionPricing.ts` and retire publish-rate bypass for Pro.
