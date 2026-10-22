# Post wizard: intent-first first screen and a title on every step

Status: built and committed 2026-10-22 (web and mobile); not yet deployed. Mobile needs a store build or OTA.

## Why
Every step of the post wizard carried the same "Post an ad" title, and the second step had no heading at all, only
Sell / Rent buttons. Three categories (plot, PG, interiors) have a single way to post, so their second step was skipped
while the step tracker still said "4 steps". People also think "I want to rent out my flat" (the same intent as the ad
groups), not "pick a category, then a transaction".

## What changed (web `PostAdWizard.tsx`, mobile `PostAdWizard.tsx`)
- **Three steps, not four:** *What you're posting* -> *Details* -> *Preview Ad*. The separate transaction step is gone.
- **First screen, intent first:** "What would you like to do?" (Sell, Rent out, Lease out), then "What are you listing?"
  with the category tiles. Choosing an intent dims the categories that cannot be posted that way (no "rent a plot"). Choosing a
  category with an intent already chosen goes straight to Details. Choosing a category first still works: a single-way
  category (plot, PG, interiors) goes straight on; any other waits with a hint "Now choose what you want to do with your
  apartment". Tapping an intent that the chosen category cannot do clears the category.
- **Question headings on each step:** Details: "Tell us about the apartment you're renting out". Preview: "Does your ad look right?".
  On mobile the header title also follows the step ("Post an Ad", "Add details", "Preview your ad").
- Back from Details always returns to the first screen (it used to pick between two screens).

## Funnel events and old data
- The `Step` type keeps `"transactionType"` and the synthetic path `/post/transaction-type`; the admin `pageTrail.ts` decoder is
  unchanged, so old rows still read correctly. **New sessions no longer emit `post_step_view` for `transactionType`**; the
  sequence is now `category` -> `details` -> `review`. When comparing across the change, treat "reached category" as the old
  "reached category", and "reached details" as before; the old transaction-type step had no direct equivalent.
- A draft saved on the old transaction step resumes on the first screen with its category selected.
- Entry presets (`?category=&transactionType=`, used by ad landing links) behave as before: a valid pair goes to Details, a
  category alone waits on the first screen for the intent.

## Checks
- Web and mobile typecheck. `apps/web/src/lib/postingRules.test.ts` pins the rules the screen relies on (every intent has
  categories; every category is reachable; plot is sale-only and PG rent-only).
- Not yet clicked through in a browser or on a device.
