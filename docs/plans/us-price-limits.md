# US price limits

Status: **built 2026-11-28, not merged or deployed.** The first proposal's limits were replaced, at the owner's request,
by limits based on US averages. Part of the US launch ([us-market-expansion.md](us-market-expansion.md)).

## Problem

The plausibility limits on prices were rupee figures applied to every market (`PRICE_BOUNDS` in
`packages/types/src/priceBounds.ts`). They guard against typing mistakes and scam prices, and they decide what the server
accepts for a new or edited ad and for a requirement's budget. On the US they rejected ordinary ads:

| Example US ad | Before |
|---|---|
| Apartment for rent at $950 a month | Rejected (minimum $1,000) |
| 5x10 storage unit at $85 a month | Rejected (minimum $200) |
| Small office at $1,800 a month | Rejected (minimum $5,000) |
| Condo for sale at $85,000 | Rejected (minimum $100,000) |

All four are accepted now.

## US limits

An average cannot itself be a limit (about half of all ads fall on the wrong side of it), so each limit is **a tenth of
the national average to fifty times it**, rounded. `lease` counts as rent. India's limits are unchanged.

| Category | National figure used | Allowed |
|---|---|---|
| House, apartment, villa, condo, townhouse: sale | $416,700, median existing home, October 2026 | $40,000 to $20,000,000 |
| House, apartment, villa, condo, townhouse: rent | about $2,000 a month, all rental types | $200 to $100,000 |
| Room: rent | about $1,000 a month (estimate, see below) | $100 to $50,000 |
| Storage: rent | about $119 a month, 10x10 unit | $10 to $6,000 |
| Commercial: sale | $575,000, median recorded sale, Q3 2026 | $50,000 to $30,000,000 |
| Commercial: rent | none | $100 to $1,000,000 |
| Storage: sale | none | $1,000 to $10,000,000 |

- **Room rent** is an estimate: SpareRoom publishes city figures ($750 to $1,515 across 26 metros, Q2 2026), and no
  national one was found.
- **Commercial rent** is published per square foot per year, so no monthly average exists without assuming a size. The
  range is simply wide.
- **Storage sale**: no national price was found. The range is simply wide.
- The price boxes' typing ceilings (`listingLimits.ts`: $200,000,000 sale, $1,000,000 rent) stay.

Sources, as reported by web search on 2026-11-28 (the pages themselves were not read):
[NAR existing-home sales](https://www.nar.realtor/newsroom/existing-home-sales-decreased-5-5-percent-october-nar-report),
[Zillow rental trends](https://www.zillow.com/rental-manager/market-trends/united-states/) (apartment-only medians are
lower: [Apartment List](https://www.apartmentlist.com/research/national-rent-data) $1,384),
[SpareRoom statistics](https://www.spareroom.com/statistics),
[StorageCafe unit prices](https://www.storagecafe.com/storage-unit-prices/),
[Realmo Q3 2026](https://realmo.com/files/realmo-q3-2026-market-report.pdf).

## Dollars in the same screens

| Where | Before, on the US | Now |
|---|---|---|
| Ad form labels | "Security deposit (₹)", "Maintenance fee (₹)", "Brokerage Fee (₹)" | `($)` |
| Ad page values | "₹1,500" | "$1,500" |
| Brokerage rules | A fixed fee under $500 (under $1,000 on a sale) rejected | Any amount above zero; the ceilings of 5% of a sale price and two months' rent stay |
| Price errors | ₹ and lakh | Dollars |

## Posting a home was blocked

Found while building this: the post form's checklist (`postDetailsIssues`) ignored the market, so a US house, apartment,
villa, condo or townhouse ad was told "Entrance facing is required" for a field the US does not show. Preview stayed
blocked on the website and the app. It now takes the market. The admin edit form had the same omission.

## How

- `priceBounds.ts`: `US_PRICE_BOUNDS` beside India's, read through `priceBoundsFor(category, transactionType, marketId)`
  by `listingPriceIssue` and `requirementBudgetIssue`.
- `categoryFields.ts`: `categoryFieldsFor(category, marketId)` gives a market's labels and minimums (India gets the shared
  config itself); `formatFieldValue` and the brokerage rules take the market.
- India is the default of every new argument. The server passes its `MARKET`; the website, app and admin pass theirs.
- Tests: `apps/bff/src/market/us-price-limits.spec.ts`.

## Deploy

US `bff`, `web` and `admin`. The app needs a new build: builds made before this change keep the old limits and still ask
a US home ad for the entrance facing. India's behaviour is unchanged, so India needs no deploy.

## Not verified

- The US ad form has not been viewed in a browser or on a phone with this change.
- Whether any existing US ad has a price outside the new limits.
- Whether brokerage fields should be offered on the US at all; US rules on broker fees differ by state and city.
- The web's test-ad scenarios (`postAdScenarios.ts`) still use India's limits.
