# Target ROAS for Bhavano's value-carrying conversions

## Status: proposed (2026-10-06) — not yet actionable; this doc defines the trigger to revisit

## Context

Target ROAS only makes sense where conversions carry a *real, varying* value Google Ads can
bid against. Checked the live account for whether that case exists today, and whether any
current campaign needs to change to support it. Short answer: **it doesn't exist yet, and no
campaign should move to Target ROAS now** — but one real, actionable issue surfaced along the
way that's worth fixing regardless of ROAS.

## Current state (pulled live from the Ads account, trailing 90 days)

Bhavano has exactly 4 `PURCHASE`-category conversion actions — the only candidates for ROAS,
since every other biddable category (`SUBMIT_LEAD_FORM`, `SIGNUP`, `PHONE_CALL_LEAD`) is a
value-less lead action:

| Conversion action | Status | Conversions (90d) | Value (90d) | Avg value |
|---|---|---|---|---|
| Boost purchase | ENABLED | 24 | ₹1,460 | ₹61 |
| Subscription purchase | ENABLED | 0 | ₹0 | — |
| Contact reveal credits purchase | ENABLED | 0 | ₹0 | — |
| Instant alerts purchase | **REMOVED** | 0 | ₹0 | — |

Also found: a GA4-linked "Purchasers of bhavano-23f72" remarketing audience already exists but
has **0 members** — consistent with how little purchase volume is actually happening. "All Users
of bhavano-23f72" (3,500 members) exists and would be the base list for any future
purchase-focused remarketing campaign.

**Why this rules out Target ROAS today:** even the account's own documented rule of thumb
(`seeker-intent-campaign.md`: "~30-conversion/month before trusting an automated target") isn't
met by the single active purchase type (Boost, ~8/month), let alone with real value *variance*
for ROAS to learn from — a strategy that predicts expected value per auction needs more signal
than one that just predicts conversion probability. Subscription and Contact reveal credits are
at zero; Instant alerts purchase isn't even tracked right now (see below).

## A related issue this surfaced (separate from ROAS, worth fixing either way)

**`PURCHASE` is a biddable goal at the account level, inherited by every campaign** —
confirmed via `customer_conversion_goal`/`campaign_conversion_goal`: all 8 poster campaigns,
`Metro-Seeker Intent`, and the two paused `Leads-` campaigns all show `PURCHASE: biddable=True`.
This is the exact same structural problem `ads_retarget_owners.py` already diagnosed and fixed
for `ENGAGEMENT`/"Save a search" (a category meaning two different things bleeding into one
blended bid target) — except here it's live and unaddressed: every Target CPA poster campaign is
currently bidding, in part, toward rare Boost/Subscription/Contact-reveal purchases that happen
long after the click (registration → posting → usage → eventual purchase), which is weak,
noisy, hard-to-attribute signal to blend into a lead-gen CPA target.

**Also found, not this doc's main subject but flagging for a separate decision:** `Metro-Seeker
Intent`'s own actual goal — "Save a search" — is now `ENGAGEMENT` category, and `ENGAGEMENT` is
`biddable=False` account-wide (set that way by `ads_retarget_owners.py`'s account-wide toggle,
which wasn't scoped to just the two `Leads-` campaigns it was written for). That means the seeker
campaign's Target CPA is currently bidding toward `PURCHASE`/`SIGNUP`/`SUBMIT_LEAD_FORM` instead
of the one action it was built to drive. This needs its own confirmation and fix — not rolled
into this plan, since it's a correctness bug independent of whether ROAS ever happens.

## Decision: not actionable now — here's the trigger to revisit

Don't build a dedicated Target ROAS campaign yet. Instead:

1. **Data hygiene first, regardless of ROAS:**
   - Fix the `Instant alerts purchase` conversion action (currently `REMOVED` — the
     `instant_alerts_purchase` dataLayer event has nowhere to land, same gap
     `ads_setup_conversions.py`'s own comment already flagged when it was added).
   - Decide whether to exclude `PURCHASE` from the poster/seeker campaigns' biddable goal set
     (campaign-specific goal = `SUBMIT_LEAD_FORM` only for poster campaigns), the same fix
     pattern already used for `ENGAGEMENT`. Recommended: yes — rare purchase noise shouldn't be
     blended into lead-gen CPA bidding it can't reliably attribute.
2. **No new campaign needed yet.** There is no audience or acquisition path today whose job is
   specifically "get someone to buy Boost/Subscription/Instant Alerts" — those happen downstream
   of the existing poster funnel. Don't build one prematurely; first watch whether organic Boost
   purchase volume grows as the poster campaigns keep running (it's the only purchase type with
   any volume at all).
3. **The trigger to actually revisit this plan:** when **any single** purchase-type conversion
   action sustains **≥30 conversions/month for 4–6 consecutive weeks**, with real value variance
   (not everyone paying the exact same price) — not summed across all four, since ROAS is set
   per campaign against one goal set, and mixing immature signal with mature signal just dilutes
   the strong one. Today, Boost purchase is the only candidate anywhere close, and it's at ~8/month
   — roughly 4x short of the threshold.
4. **When that trigger is hit, the campaign changes required are:**
   - A **standalone campaign** for that purchase goal, own budget, own campaign-specific
     conversion goal set containing only that `PURCHASE` action — never shared with the poster
     campaigns' Target CPA or the `Bhavano-TargetCPA` portfolio (same "don't mix intents"
     principle already applied to seeker vs. poster). A campaign on a shared bidding portfolio
     can't run a different strategy than the rest of that portfolio, so this has to be separate
     by construction.
   - Likely built on the existing "Purchasers"/"All Users" GA4 remarketing audiences rather than
     fresh cold-audience keywords, since the target behavior (buy an upgrade) is a bottom-of-funnel
     action better reached via remarketing than new Search keywords.
   - Start the campaign on **Maximize Conversions** (value-less) until it alone has the ~30/month
     volume, *then* switch to **Maximize Conversion Value with a Target ROAS**, with the initial
     target set from that campaign's own trailing average value-to-cost ratio — not guessed. This
     mirrors exactly how `Metro-Seeker Intent` was deliberately left on Maximize Conversions
     without a target until it had real volume to base one on.

## Not doing (for this plan)

- Not switching any existing campaign to Target ROAS now — none has the data for it.
- Not building a new purchase-acquisition campaign yet — no evidence it's needed before the
  trigger above is hit.
- Not fixing the `Metro-Seeker Intent` ENGAGEMENT-goal issue as part of this doc — flagged above,
  needs its own separate confirmation and change.

## Open questions

- Should `Instant alerts purchase` be fixed by re-enabling the existing (removed) action, or
  recreating it fresh? Worth checking why it ended up `REMOVED` before deciding.
- Does excluding `PURCHASE` from the poster campaigns' goal set risk losing the one real signal
  (24 Boost purchases/90d) Smart Bidding currently has *some* access to, even if noisy? Worth a
  quick before/after CPA check if this change is made.

## Follow-up: the two related issues, analysed and fixed (2026-10-06)

Deeper look at both issues flagged above, with real numbers pulled from the account.

### Metro-Seeker Intent — worse than flagged, not just "no clean signal"

Its `campaign_conversion_goal` rows show `ENGAGEMENT` (Save a search, its actual goal)
`biddable=False`, while `PURCHASE`/`SIGNUP`/`SUBMIT_LEAD_FORM`/`PHONE_CALL_LEAD` are all `True`
(inherited, untouched, from the account default). Its 90-day conversions by action:

| Action | Category | Count |
|---|---|---|
| New registration | SIGNUP | 11 |
| **Post ad success** | **SUBMIT_LEAD_FORM** | **2** |
| Save a search | ENGAGEMENT | 1 |

Target CPA's official "conversions" metric for this campaign = 2, and **both are "Post ad
success" — a poster action.** The campaign built explicitly to never mix poster/seeker intent is
having its Smart Bidding driven entirely by people who posted an ad, while its real goal (1
Save-a-search) is invisible to the algorithm. Root cause: `ads_retarget_owners.py`'s account-wide
`ENGAGEMENT` toggle (written for the `Leads-` campaigns) wasn't scoped, and this campaign never
got the campaign-specific goal override its own design doc called for.

### Poster campaigns — real but smaller dilution

90-day Boost-purchase attribution by campaign: 1–7 events per campaign (e.g. Metro-Generic Post
Ad Intent: 7, value ₹380), against each campaign's much larger Post-ad-success volume (272
account-wide). Genuine signal, genuinely the wrong kind for a campaign whose stated,
`primary_for_goal=True` goal is "Post ad success" — consistent noise, not a dominant one.

### Fix applied, via `ads_fix_conversion_goals.py`

Confirmed in the API docs that `CampaignConversionGoal.biddable` is directly, independently
overridable per campaign without touching the account default (no need for the heavier
`ConversionGoalCampaignConfig`/custom-goal machinery) — so both fixes are scoped,
reversible, campaign-level overrides:

1. **Metro-Seeker Intent**: `ENGAGEMENT -> biddable=True`; `PURCHASE`/`SIGNUP`/
   `SUBMIT_LEAD_FORM`/`PHONE_CALL_LEAD -> biddable=False`. Exactly the "campaign-specific
   conversion goal set containing only Save a search" `seeker-intent-campaign.md` asked for.
2. **Metro-Seeker Intent, bidding strategy**: moved off the shared `Bhavano-TargetCPA` portfolio
   onto standalone Maximize Conversions with no target (user's call, 2026-10-06) — after the
   goal fix it has had exactly 1 real conversion ever, nowhere near enough to share a target
   calibrated against poster-campaign costs. Matches the original pilot's own bidding plan.
3. **8 poster campaigns + the 2 paused `Leads-` campaigns**: `PURCHASE -> biddable=False`,
   campaign-scoped. Account-wide `PURCHASE` stays biddable, so a future purchase-focused
   campaign (see the main plan above) can still use it.

Dry-run and `--validate` both confirmed clean (16 operations) before any live change.

**Applied 2026-10-06, in two passes.** The first run reported "applied 16 operation(s)" with no
error, but read-back showed 3 of the 16 had silently not changed: Metro-Seeker Intent's bidding
strategy, and the `PURCHASE` flag on the two paused `Leads-` campaigns. Root cause:
`protobuf_helpers.field_mask(None, pb)` (the mask-derivation helper used throughout this repo's
Ads scripts) builds the mask by diffing against an all-default message — so setting `biddable`
to `False` (proto3's zero value) or a oneof to an all-default sub-message (`maximize_conversions`
with no target) is indistinguishable from "never touched," and gets silently dropped from the
mask. Same class of gotcha `ads_retarget_owners.py`'s own comments already flagged for
`primary_for_goal = False` on this account. Fixed by setting `update_mask.paths` explicitly
rather than deriving it (`ads_fix_conversion_goals.py` now does this everywhere), re-ran, and
confirmed via a second read-back that all 16 changes — including the bidding-strategy switch —
are live and correct. Worth keeping in mind for any future script in this repo that sets a field
*to* its default/falsy value: the auto-derive helper cannot be trusted for that case.

