# Add a "Tools" section: 6 property calculators

## Context

Bhavano currently has no self-service calculators — buyers/renters browsing
listings have no way to estimate EMI, loan eligibility, affordability, or
convert regional area units without leaving the site. This adds a new,
standalone "Tools" section with 6 calculators, linked from its own tab in the
main nav (alongside Buy/Rent/PG), the header utility strip, and the footer —
both a useful feature and a source of new indexable, differentiated SEO
content (calculator pages consistently attract organic search traffic on
real-estate sites).

Scope, confirmed with the product owner:
1. **EMI Calculator**
2. **Home Loan Eligibility Calculator**
3. **Area Unit Converter** (sqft/sqm/acre/hectare/cent only — regionally
   inconsistent units like guntha/bigha/marla/kanal are deliberately excluded
   since their conversion factor varies by state and risks showing wrong
   numbers)
4. **Rent Affordability Calculator**
5. **Rent vs. Buy Calculator**
6. **Down Payment Calculator**

Explicitly out of scope (flagged, not built): Stamp Duty and Property Tax
calculators — both need a maintained per-state/per-city rates table, which is
ongoing upkeep, not a one-time build. Worth a future ask once there's a plan
for keeping that data current.

Nav placement, confirmed: a "Tools" entry should visually sit in the same tab
row as `CategoryTabs` (Buy/Rent/PG), not just be a small utility-strip link —
but implemented as a plain decoupled link, not folded into the
`HomeCategoryFilter`/`HOME_TABS` system (see §5).

## 1. Route & file structure

Follows the existing flat-folder static-page convention exactly (`help`,
`contact`, `terms`, `privacy` — no nested `layout.tsx` anywhere in `app/`; each
`page.tsx` calls `StaticPageLayout` directly). No new layout mechanism.

```
apps/web/src/app/tools/
  page.tsx                                       # index: 6 cards, fully server
  emi-calculator/page.tsx
  home-loan-eligibility-calculator/page.tsx
  area-unit-converter/page.tsx
  rent-affordability-calculator/page.tsx
  rent-vs-buy-calculator/page.tsx
  down-payment-calculator/page.tsx

apps/web/src/components/tools/
  ToolCard.tsx              # server — index-page card
  CalculatorCard.tsx        # client — shared shell: inputs + live-result panel
  NumberField.tsx           # client — shared labeled numeric input
  EmiCalculatorForm.tsx     # client leaf, one per calculator
  HomeLoanEligibilityForm.tsx
  AreaUnitConverterForm.tsx
  RentAffordabilityForm.tsx
  RentVsBuyForm.tsx
  DownPaymentForm.tsx

apps/web/src/lib/
  calculatorFormulas.ts     # pure functions, no React — all 6 calculators' math
  formStyles.ts             # shared fieldClass/labelClass/button classes (new)

apps/web/src/components/home/
  FaqGroup.tsx              # extracted from help/page.tsx (see §4)
```

## 2. Server/client split (per SEO conventions in this repo's CLAUDE.md)

Same pattern already used for `BrowseSeoIntro` (server) + interactive filters
(client): each calculator `page.tsx` stays a server component owning
`metadata`, heading, explanatory copy, FAQ, and JSON-LD. Only the form+result
widget is `"use client"`.

```tsx
// apps/web/src/app/tools/emi-calculator/page.tsx
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { EmiCalculatorForm } from "@/components/tools/EmiCalculatorForm";

export const metadata = {
  title: "EMI Calculator — Bhavano",
  description: "Free EMI calculator: estimate your monthly home loan installment from loan amount, interest rate and tenure.",
};

// Plain strings (not JSX) — this exact array doubles as the FAQPage JSON-LD source below.
const FAQS: Faq[] = [ /* q/a pairs, plain-string answers */ ];

export default function EmiCalculatorPage() {
  return (
    <StaticPageLayout title="EMI Calculator">
      <PageSection heading="Calculate your monthly EMI"><EmiCalculatorForm /></PageSection>
      <PageSection heading="How EMI is calculated"><p className="m-0">...</p></PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd
        data={{
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a as string } })),
        }}
      />
    </StaticPageLayout>
  );
}
```

Every page in this section follows this exact shape. The index page
(`app/tools/page.tsx`) is fully server-rendered — a static card grid needs no
interactivity.

## 3. Shared form styles (new module, and a small cleanup of existing duplication)

`fieldClass`/`labelClass`/button classes are currently copy-pasted verbatim in
both `PostAdWizard.tsx` and `SavedSearchesManager.tsx`. Adding 6 more
calculators would make a third (and much larger) set of copies — extract now:

```ts
// apps/web/src/lib/formStyles.ts
export const fieldClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";
export const labelClass = "text-[13px] font-bold text-text-soft mb-1.5 block";
export const primaryButtonClass = "bg-green text-on-green border-0 rounded-lg px-6 py-3 text-sm font-bold cursor-pointer disabled:opacity-60";
export const secondaryButtonClass = "bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer disabled:opacity-60";
export const outlineButtonClass = "text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-4 py-2.5 cursor-pointer bg-transparent";
```

Update `PostAdWizard.tsx` and `SavedSearchesManager.tsx` to import from here
instead of redeclaring locally (removing their local consts) — minor,
low-risk visual convergence (a couple of px of button padding), justified by
having one source of truth before a third set of copies appears. All 6
calculator forms + `NumberField.tsx` import from this module too, never
redeclare.

## 4. Shared FAQ component (extract from `help/page.tsx`)

`help/page.tsx` already has a private `Faq`/`FaqGroup` (interface + a
`<details>`-rendering component) that's exactly what the 6 calculator pages
need. Move it to `apps/web/src/components/home/FaqGroup.tsx` (export `Faq`
type + `FaqGroup` component, using `PageSection` internally exactly as today),
and have `help/page.tsx` import it back — no behavior change there, just
de-duplicating before 6 new call sites would otherwise reimplement the same
`<details>` block. Calculator pages type their FAQ arrays as
`{ q: string; a: string }[]` (plain strings satisfy `Faq.a: ReactNode`) so the
same array feeds both the visible FAQ and the `FAQPage` JSON-LD with no
duplication.

## 5. Nav — a static, decoupled "Tools" tab (not part of `HomeCategoryFilter`)

`CategoryTabs.tsx` maps over `HOME_TABS: HomeCategoryFilter[]`, and its
`onTabClick`/`active`/`MegaMenu` machinery is entirely built around
city-scoped listing-category browsing (`HomeCategoryFilter` is load-bearing
across the SEO browse-route system elsewhere in the codebase). Folding "Tools"
into that type/array would ripple into unrelated routing logic for no benefit
— it's not a listing category. Instead, render a plain `<Link>` as a trailing
sibling in the same flex row, styled to match the tab buttons, with its own
`usePathname()`-based active state:

```tsx
// apps/web/src/components/home/CategoryTabs.tsx — add:
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation"; // usePathname added

// inside CategoryTabs(), alongside existing router/searchParams:
const pathname = usePathname();
const toolsActive = pathname.startsWith("/tools");

// inside the `<div className="flex gap-1.5 overflow-x-auto">`, after `{HOME_TABS.map(...)}`:
<Link
  href="/tools"
  className={`flex items-center gap-2 border-0 border-b-[3px] pt-3 px-[18px] pb-2.5 text-sm font-bold whitespace-nowrap ${
    toolsActive ? "bg-surface-alt text-text border-b-gold" : "bg-transparent text-text-soft border-b-transparent"
  }`}
>
  <span>🧮</span> Tools
</Link>
```

No changes to `HomeCategoryFilter`, `HOME_TABS`, `buildHomeUrl`, or
`onTabClick`/`onTabHover`. `CategoryTabs` is rendered inside `Header.tsx`,
which is used both directly (browse pages) and via `PageHeader.tsx` (static/
account pages, including the new `/tools/*` pages themselves) — so this tab
appears site-wide automatically, and correctly highlights on the tools pages.

Also add matching entries to the existing link lists (same pattern as
`Help`/`For Owners`):
- `Header.tsx`'s green utility strip (`apps/web/src/components/home/Header.tsx:45-52`) — add `<Link href="/tools">Tools</Link>` between "For Owners" and "Help".
- `Footer.tsx`'s Company block (`apps/web/src/components/home/Footer.tsx:89-95`) — add `<Link href="/tools">Tools</Link>` between "Post a free ad" and "Help centre".

## 6. Formulas (`apps/web/src/lib/calculatorFormulas.ts`, pure functions, no rounding until display)

**EMI** — standard reducing-balance amortization, `r` = monthly rate, `n` = months:
```ts
export function calculateEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}
```

**Home Loan Eligibility** — EMI formula inverted for principal, against a
labeled/adjustable **FOIR** (Fixed Obligation to Income Ratio, default 50%,
range 30-60%, with copy explaining lenders typically cap total EMIs at
40-50% of income):
```ts
export function calculateMaxLoanAmount(monthlyIncome: number, existingMonthlyEmis: number, foirPercent: number, annualRatePercent: number, tenureMonths: number): number {
  const availableEmi = Math.max(0, monthlyIncome * (foirPercent / 100) - existingMonthlyEmis);
  const r = annualRatePercent / 12 / 100;
  if (availableEmi === 0) return 0;
  if (r === 0) return availableEmi * tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (availableEmi * (factor - 1)) / (r * factor);
}
```

**Area Unit Converter** — canonical base = sqm (the one exact SI unit),
everything else derived from it so there's one source of truth:
```ts
export type AreaUnit = "sqft" | "sqm" | "acre" | "hectare" | "cent";
export const AREA_UNIT_TO_SQM: Record<AreaUnit, number> = {
  sqft: 0.09290304,      // exact: (0.3048m)^2
  sqm: 1,
  acre: 4046.8564224,    // exact: 43,560 sqft
  hectare: 10000,        // exact, by definition
  cent: 40.468564224,    // exact: acre / 100
};
export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return (value * AREA_UNIT_TO_SQM[from]) / AREA_UNIT_TO_SQM[to];
}
```

**Rent Affordability** — simple ratio, default 35% (midpoint of the common
30-40% rule of thumb), adjustable:
```ts
export function calculateMaxAffordableRent(monthlyIncome: number, rentPercent: number): number {
  return monthlyIncome * (rentPercent / 100);
}
```

**Rent vs. Buy** — undiscounted nominal cash-flow comparison over a chosen
horizon `H` years (explicitly *not* NPV/time-value-adjusted — must say so in
the page copy). Inputs: property price, down-payment %, loan rate/tenure,
current monthly rent, annual rent escalation % (default 5), annual property
appreciation % (default 5), annual ownership-cost % of current value covering
maintenance+property tax (default 1.5), one-time buying cost % covering stamp
duty/registration (default 7, labeled as a rough India-wide average),
comparison horizon in years:
```ts
export interface RentVsBuyResult {
  totalRentCost: number; netCostOfBuying: number;
  propertyValueAtHorizon: number; outstandingLoanAtHorizon: number;
  netEquityAtHorizon: number; difference: number; // rent - buy; positive => buying cheaper
}
export function calculateRentVsBuy(inputs: {
  propertyPrice: number; downPaymentPercent: number; annualRatePercent: number; loanTenureYears: number;
  currentMonthlyRent: number; annualRentEscalationPercent: number; annualPropertyAppreciationPercent: number;
  annualOwnershipCostPercent: number; oneTimeBuyingCostPercent: number; comparisonHorizonYears: number;
}): RentVsBuyResult {
  const { propertyPrice: P, downPaymentPercent: dp, annualRatePercent, loanTenureYears: nLoanYears,
    currentMonthlyRent: R0, annualRentEscalationPercent: gRent, annualPropertyAppreciationPercent: gProp,
    annualOwnershipCostPercent: m, oneTimeBuyingCostPercent, comparisonHorizonYears: H } = inputs;
  const downPayment = P * (dp / 100);
  const loanAmount = P - downPayment;
  const monthlyEmi = calculateEmi(loanAmount, annualRatePercent, nLoanYears * 12);
  let buyOutflow = downPayment + P * (oneTimeBuyingCostPercent / 100);
  let rentCost = 0;
  for (let y = 1; y <= H; y++) {
    buyOutflow += (y <= nLoanYears ? monthlyEmi * 12 : 0) + P * Math.pow(1 + gProp / 100, y) * (m / 100);
    rentCost += R0 * Math.pow(1 + gRent / 100, y - 1) * 12;
  }
  const propertyValueAtHorizon = P * Math.pow(1 + gProp / 100, H);
  const outstandingLoanAtHorizon = remainingLoanBalance(loanAmount, annualRatePercent, nLoanYears * 12, Math.min(H, nLoanYears) * 12);
  const netEquityAtHorizon = propertyValueAtHorizon - outstandingLoanAtHorizon;
  const netCostOfBuying = buyOutflow - netEquityAtHorizon;
  return { totalRentCost: rentCost, netCostOfBuying, propertyValueAtHorizon, outstandingLoanAtHorizon, netEquityAtHorizon, difference: rentCost - netCostOfBuying };
}

/** Remaining principal after `monthsElapsed` of an `n`-month amortizing loan. */
function remainingLoanBalance(loanAmount: number, annualRatePercent: number, n: number, monthsElapsed: number): number {
  if (monthsElapsed >= n) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return loanAmount * (1 - monthsElapsed / n);
  const factorN = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, monthsElapsed);
  return (loanAmount * (factorN - factorK)) / (factorN - 1);
}
```
`difference = totalRentCost − netCostOfBuying`; positive means buying works
out cheaper over the horizon. The page copy/FAQ must explicitly list what's
**excluded** (opportunity cost of the down payment, home-loan tax deductions,
resale/brokerage costs, rental yield if the property were rented out instead)
— naming the exclusions is safer than silently omitting them, and every
calculator page gets a plain "these are estimates, not financial advice"
line, most prominently on this one.

**Down Payment**:
```ts
export function calculateDownPaymentFromLtv(propertyPrice: number, ltvPercent: number) {
  const loanAmount = propertyPrice * (ltvPercent / 100);
  return { downPayment: propertyPrice - loanAmount, loanAmount };
}
export function calculateDownPaymentFromLoanAmount(propertyPrice: number, desiredLoanAmount: number) {
  return { downPayment: propertyPrice - desiredLoanAmount, impliedLtvPercent: (desiredLoanAmount / propertyPrice) * 100 };
}
```
UI toggles between "I know my LTV%" and "I know my desired loan amount." Adds
a plain-text cross-link to `/tools/emi-calculator` rather than embedding EMI
math here — keeps each tool self-contained, still gets internal-linking SEO
value.

## 7. Shared calculator-widget atoms (not a generic engine)

The 6 forms are too structurally different for one config-driven "calculator
engine" (EMI takes 3 flat inputs; Area Converter is bidirectional value+two
dropdowns with no single "result" field; Rent vs. Buy has ~8 inputs and 6
outputs) — forcing them through one abstraction would be more complex than 6
bespoke components. Two things genuinely repeat and are worth extracting:

- `NumberField.tsx` — labeled numeric `<input>` using `labelClass`/`fieldClass` from `formStyles.ts`.
- `CalculatorCard.tsx` — bordered card shell (inputs + a result panel with a big `font-lora` green result value), matching the visual language already used by listing cards/`StaticPageLayout`.

Each of the 6 `*Form.tsx` components owns its own `useState` + calls into
`calculatorFormulas.ts` + composes `NumberField`/`CalculatorCard` — no shared
form-config schema.

## Files touched

- `apps/web/src/lib/calculatorFormulas.ts` (new), `apps/web/src/lib/formStyles.ts` (new)
- `apps/web/src/components/home/FaqGroup.tsx` (new, extracted); `apps/web/src/app/help/page.tsx` (import instead of local copy)
- `apps/web/src/components/home/PostAdWizard.tsx`, `SavedSearchesManager.tsx` (import shared form styles instead of local consts)
- `apps/web/src/components/home/CategoryTabs.tsx`, `Header.tsx`, `Footer.tsx` (nav entries)
- `apps/web/src/components/tools/*` (new: `ToolCard`, `CalculatorCard`, `NumberField`, 6 `*Form.tsx`)
- `apps/web/src/app/tools/**/page.tsx` (new: 1 index + 6 calculator pages)

## Verification

1. `pnpm --filter web tsc --noEmit` and `eslint` on all touched/new files — clean.
2. Manual, `pnpm dev`: visit `/tools`, confirm all 6 cards link correctly; on
   each calculator page confirm inputs produce sane results (spot-check EMI
   against a known value, e.g. ₹50L @ 8.5% for 20 years ≈ ₹43,391/month; area
   converter round-trips a value through two units back to itself).
3. Confirm the "Tools" entry renders and highlights correctly in the main tab
   row on both a city browse page and a static page (e.g. `/help`), and that
   `/tools/*` pages themselves show it highlighted.
4. View source (or "Inspect" → Elements, not the rendered DOM after JS) on one
   calculator page to confirm the heading/explanatory copy/FAQ text is present
   in the initial server-rendered HTML, and the `FAQPage` JSON-LD `<script>`
   tag is present — confirming the SEO-critical content isn't client-only.
5. Confirm `PostAdWizard`/`SavedSearchesManager` still render identically
   (mod a couple px of button padding) after the `formStyles.ts` refactor.
