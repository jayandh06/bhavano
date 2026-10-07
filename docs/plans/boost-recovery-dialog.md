# "Why Boosting Helps" recovery dialog on the post-ad preview step

## Status: approved 2026-10-01, building now

**Update (2026-10-07): third trigger added — clicking Skip itself.** The original two triggers
(idle timeout, Post-ad submit-intercept) only caught someone who had *already* skipped and was
now trying to leave. A seller who clicked "Skip — post without featuring" and then kept scrolling
the review screen — never idling 60s, never tapping Post ad again before changing their mind some
other way — never saw the pitch at all. Fixed by making the Skip link itself open the dialog
*before* committing to the skip (`BoostPlanSelector`'s new `onSkipAttempt` prop, both platforms),
with two outcomes that both just return to the review screen rather than posting anything:
"Apply Feature" (closes the dialog, selection untouched — it was never cleared) or "Cancel" (the
deferred commit — `selectedBoostPlan` becomes `null` only now). This made the original two
triggers effectively unreachable in practice (skip can now only happen via this same flow, which
already marks the "shown once" ref), but they're left in place as a safety net rather than removed.

Also landed on **mobile**, despite this doc's original "web only" scope — the Guideline 3.1.1
constraint that scoped the idle/submit triggers out of mobile is about the *checkout* flow
(BoostModal's native-vs-redirect split), which this skip-click dialog never touches: both its
outcomes just change local selection state, no payment, no redirect. Mobile gets a standalone,
narrower `BoostRecoveryDialog.tsx` (just this one trigger, named `onApplyFeature`/`onCancel`
instead of web's posting-flow-oriented `onAddBoost`/`onSkip`) rather than porting the idle-timer/
submit-intercept machinery, which mobile still doesn't have.

## Goal

When `showSelectorOnPreview` is on and a seller skips Boost (or is about to leave without
deciding), show one interstitial that makes the case for boosting using real numbers — not
generic marketing copy — before they finish posting without it.

## Trigger conditions

Fire the dialog **once per listing-post attempt**, on whichever of these happens first:

1. **Navigate-away attempt**: the seller taps "Post ad" while Boost is currently **skipped**
   (`value === null` in `BoostPlanSelector`'s state).
2. **Idle timeout**: 60 seconds elapse on the preview step with Boost still skipped.

Scoped to only fire when boost is skipped, not when the pre-filled default (15-day boost) is
still selected — nagging someone who's already going to boost adds friction for no reason. At
most once per attempt, same discipline as the login nudge's one-ask-per-view rule.

"Navigate away" is implemented as **intercepting the Post-ad submit action itself** (show the
dialog instead of submitting, once, if skipped) rather than hooking browser unload events — this
is a client-side wizard, not full page navigations, so `beforeunload` is unreliable. A real
exit-intent (mouse leaving through the top of the viewport) could be added later, matching the
guest-save exit prompt, but v1 is submit-intercept + idle-timer only.

## The real-data requirement

"Based on historical results" means an actual computed number, never fabricated copy. Two
constraints, both deliberate:

**1. Current sample size is thin.** ~17–18 total Boost purchases in the last 30 days,
account-wide, measured directly during the Ads bidding-value audit this session. Any per-listing
comparison computed on a sample that small is noisy and could flip sign next month.

**2. Compute it for real, but gate the message on sample size:**
- One query/service compares boosted vs. non-boosted listings on a metric already tracked
  cleanly: average `ListingView` count in the first 7 days of being live, and/or % that get at
  least one `ListingInterest` row in that window. No new tracking needed.
- Recomputed periodically (nightly job), cached in an admin-visible settings row — same pattern
  as `BoostPriceSettings`/`ContactRevealSetting`.
- The number-based message is **gated behind a minimum sample size** (e.g., both cohorts need at
  least N listings in the window). Below that threshold, falls back to an honest, non-numeric
  message ("Boosted ads get priority placement and reach more buyers").

## UX

A modal/bottom-sheet (not full-page) on the preview step: headline + the real stat (or honest
fallback), the boost duration options already in `BoostPlanSelector` reused inline, and a clear
"No thanks, post without boosting" escape — never a forced choice. Dismissing it lets the normal
skip proceed.

## Measurement

New GTM events: `boost_recovery_shown`, `boost_recovery_accepted`, `boost_recovery_dismissed`.
These must be added to `gtm_build.py`'s `EVENTS` dict and re-run (plus a GTM publish) to actually
reach GA4 — pushing to `dataLayer` alone does nothing, confirmed the hard way earlier this
session with the login-nudge events, which were never wired up despite being pushed for weeks.

## Scope and rollout

- **Web only, to start.** Mobile's Boost flow has extra constraints (iOS Guideline 3.1.1 forces a
  different, redirect-based treatment for `BoostModal`) — this needs its own design pass there.
- Reuses the existing `showSelectorOnPreview` admin flag as the master switch.
- Cooldown similar to the login nudge's `dismissedAt` pattern, so dismissing it once doesn't mean
  seeing it again immediately on retry within the same session.

## Implementation steps

1. **Backend**: a boost-effectiveness stats computation (service + cached settings row) — avg
   7-day views and/or contact rate, boosted vs. not, plus the sample-size gate.
2. **Frontend**: `BoostRecoveryDialog.tsx` in `apps/web/src/components/home/`, wired into the
   preview step alongside `BoostPlanSelector` — watches `value === null` + a 60s timer,
   intercepts the Post-ad submit once.
3. **GTM**: add the 3 new events to `gtm_build.py`, re-run, publish in GTM Preview.
4. **Tests**: timer logic, submit-intercept logic, and the sample-size gate (falls back to the
   non-numeric message below threshold).
