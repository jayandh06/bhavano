# Account linking: one human, two login methods

## The problem

Someone who signs in with Google and later signs in with phone OTP ends up with **two separate
accounts**. Their listings, favourites, messages, payments and subscriptions are split across
both, and neither profile page lets them fix it:

- **Adding the email** to the phone account → `This email is already associated with another
  account` (`users.service.ts` catching Prisma `P2002`)
- **Adding the phone** to the Google account → `This phone number is already linked to another
  account` (`auth.service.ts` `linkPhone`)

Both errors are dead ends. The user is told the identifier is taken — by themselves — with no way
forward.

## Root cause (verified)

The two login paths key on different unique fields and never consult each other:

| Path | Key | Creates |
|---|---|---|
| `verifyOtp` | `upsert({ where: { phone } })` | a row with **only** a phone |
| `loginWithGoogle` | `upsert({ where: { googleId } })` | a row with **only** googleId + email |

Neither checks whether the *other* identifier already belongs to someone. Nothing is wrong with
the error messages — they correctly prevent one account from claiming another's identifier. The
defect is upstream: the duplicate was created at login, and by the time the user reaches the
profile page it is too late to resolve without merging data.

## The security constraint that shapes everything

**An email is not evidence of ownership unless someone verified it.**

| Source of email | Verified? | Safe to link on? |
|---|---|---|
| Google sign-in | **Yes** — Google asserts it | **Yes** |
| Typed into the profile form | **No** | **No** |

If profile-entered email auto-linked to a matching account, anyone could type a stranger's address
and take over their account. So the two directions are not symmetrical, and cannot be fixed the
same way.

## Current scale

Measured in production on 2026-08-27: **4 users** — 2 phone-only, 2 email-only, 0 with both, 1
with a googleId. Small enough that fixing forward costs almost nothing and no bulk migration is
needed. It gets materially harder with every signup.

---

## Phase 0 — Verify email before it is stored (PREREQUISITE for phase 1)

**Phase 1 is unsafe without this.** The schema has `phoneVerifiedAt` but **no
`emailVerifiedAt`**, and `updateProfile` stores whatever address is typed into the form. That
turns an unverified claim into an identity bridge:

1. Attacker signs up by phone OTP → account A
2. Attacker types `victim@gmail.com` into their profile. It is stored unverified, and succeeds
   because no other account holds it yet
3. The real victim later signs in with Google as `victim@gmail.com`
4. Phase 1 sees an account carrying that email and adopts it → **the victim is signed into the
   attacker's account**, which the attacker still controls through phone OTP

Two accounts is an annoyance. This would be account takeover, so phase 1 must not ship first.

**Fix:**

- Add `emailVerifiedAt DateTime?` to `User`, mirroring `phoneVerifiedAt`.
- `updateProfile` sends a verification code/link to the address and stores it only once
  confirmed — or stores it immediately with `emailVerifiedAt` null and treats it as unverified
  everywhere that matters.
- `loginWithGoogle` sets `emailVerifiedAt` (Google asserts it).
- **Phase 1 adopts an existing account only when its `emailVerifiedAt` is non-null.**

That last rule is what makes the whole design safe: adoption keys on *verified* email, never on a
typed one.

An unverified email is still useful — it is where support replies go, and it is what
`ProfileCompletionBanner` is nagging for. It just must not be treated as proof of identity.

## Phase 1 — Stop creating duplicates on Google login (small, high value)

**File:** `apps/bff/src/auth/auth.service.ts`, `loginWithGoogle`

When no user matches `googleId` but one exists with that **email**, attach the googleId to the
existing user instead of creating a new row. Google has verified the address, so this is the safe
direction.

```ts
const profile = await this.googleProvider.verifyIdToken(idToken);

let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
if (!user && profile.email) {
  // Google has verified this address, so an existing account holding it is the same human —
  // adopt it rather than creating a second one. The reverse (phone -> Google) cannot be done
  // this way; see phase 2.
  const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
  // Only adopt a VERIFIED email — see phase 0. Adopting on a typed-in address would let anyone
  // claim a stranger's account by entering their address before they first sign in with Google.
  if (byEmail?.emailVerifiedAt) {
    user = await this.prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: profile.googleId, name: byEmail.name ?? profile.name },
    });
  }
}
user ??= await this.prisma.user.create({ /* … as today … */ });
```

This entirely fixes the **phone-first-then-Google** direction: the OTP user adds their email on
the profile page, later signs in with Google, and lands in the same account.

Note it deliberately does not overwrite an existing `name` — a user who set their own name should
keep it.

## Phase 2 — The reverse direction cannot be automatic

**Google-first, then OTP** has nothing to match on. At OTP time the only identifier is the phone,
and the existing Google account has no phone. A second account is unavoidable at that moment.

Two ways to soften it, in increasing cost:

### 2a. Make the error a route forward, not a wall

Today `linkPhone` and `updateProfile` return a flat conflict. Instead return a distinguishable
error code (e.g. `IDENTIFIER_BELONGS_TO_OTHER_ACCOUNT`) and have the profile page say:

> That phone number is already on another Bhavano account. If both are yours, we can merge them —
> [merge accounts].

Even without the merge built, this converts a dead end into a support request that arrives with
the context needed to resolve it by hand — which at 4 users is entirely reasonable.

### 2b. Verified self-service merge — symmetric, and cheaper than it looks

Once **every** identifier requires verification (phase 0 does this for email; phone already has
it), both directions collapse into one rule:

> If the session proves account A, and a fresh verification proves the identifier on account B,
> then one human controls both — so merging them is safe.

| Direction | Proof of account A | Proof of account B |
|---|---|---|
| Phone user adds an email | logged-in session | emailed code (phase 0) |
| Email user adds a phone | logged-in session | **OTP — already implemented** |

**`linkPhone` already gathers the proof and throws it away.** It calls
`otpService.verifyChallenge(phone, code)` *before* the conflict check, so at the moment it raises
`This phone number is already linked to another account`, the server has just confirmed the user
controls that number. The authorisation question is already answered; only the merge mechanics
are missing.

So the safety argument is settled for both directions. What remains is **not** an auth problem —
it is the data problem in phase 3, which is where the actual risk lives.

**Never merge without a fresh verification in the same session.** A previously-verified
identifier is not enough: it proves the number was controlled once, not that the person sitting
there controls it now.

### 2c. Prompt or merge automatically?

**Prompt when the other account holds anything; merge silently when it does not.**

The authorisation question is settled by then — session plus fresh verification proves one human
owns both. What is not settled is *consent*, and the asymmetry that decides it is that
verification is reversible while a merge is not: once listings, payments and subscriptions are
repointed and the losing row is gone, there is no clean undo.

Three risks specific to merging without asking:

1. **The user may not know they have two accounts.** Listings they did not expect appear in the
   account they are looking at, with no explanation.
2. **Some duplicates are deliberate** — a personal account and an agent account sharing a phone
   number. Rare, but an automatic merge destroys that intent permanently.
3. **A bug amplifies silently.** Automatic merging runs the riskiest code path for every user;
   a prompt means fewer merges, each user-initiated, so a problem surfaces while it is small.

Prompting *every* time is over-cautious though. The common duplicate is someone who logged in
once and did nothing, and making them read a warning to fix a mess the app created is poor.

**The condition is whether EITHER side is empty, not whether the other one is.** The hard part of
a merge is reconciling two non-empty datasets — deduping favourites both accounts hold, resolving
the 1:1 `outreachContact` when both have one, taking the more generous of two overlapping
subscriptions. When one side is empty none of that arises and the merge is a straight
reassignment, so the risk that justifies a prompt is not present.

| Situation | Behaviour |
|---|---|
| Either account is empty | Merge automatically, then tell them: "We've linked your accounts" |
| Both hold listings, subscriptions, payments or conversations | Prompt, itemising what moves |

Two refinements:

- **"Empty" means no listings, no subscriptions, no payments, and no conversations.** Financial
  history counts even when it is spent, because it is audit-relevant. Conversations count because
  a thread has a counterparty — merging moves a buyer's conversation to a different account, which
  affects someone who was never asked.
- **The account holding the listings always wins**, whichever one the user is signed into. The
  direction of the merge should never depend on which login they happened to use.

Automatic still means *announced*, not silent: the user is told afterwards. The distinction being
drawn is blocking versus non-blocking, not visible versus invisible.

The prompt should state the contents, not just ask:

> This phone is on another Bhavano account. You've verified both, so we can combine them.
> That account has **3 listings**, **12 favourites**, and an **active Agent Pro subscription**.
> Everything moves to this account. This can't be undone.

**Soft-delete the losing row** rather than hard-deleting it — keep it for ~30 days with the
identifiers released. That converts "irreversible" into "reversible by support", which is worth
far more than the row it costs, especially for the first months when the merge code is young.

## Phase 3 — What merging actually has to move

Every row pointing at the losing account has to be repointed, in one transaction. From
`schema.prisma`'s `User` back-relations:

| Relation | Notes |
|---|---|
| `listings` | the valuable one — losing these is unacceptable |
| `favourites` | dedupe: both accounts may favourite the same listing |
| `messages` | reassign author |
| `conversationsAsPoster` / `conversationsAsInquirer` | two FKs, both need moving |
| `payments`, `subscriptions`, `proBoostCredits` | financial — audit-sensitive, never drop |
| `savedSearches`, `supportTickets`, `loginEvents`, `visits` | straightforward reassign |
| `outreachContact` | **1:1** — a conflict if both accounts have one |
| `outreachCampaigns` | reassign |

Plus the denormalised entitlement columns on `User` itself — `premiumUntil`, `agentProUntil`,
`agentProUnits`, `sellerSlotPackUntil` — which must take the **more generous** of the two rather
than the winner's blindly, or the user loses paid entitlement.

Only then delete the losing row.

**Order the work so the account with listings always wins**, regardless of which one the user is
logged into. Merging away the account holding their ads is the one outcome worth engineering
carefully against.

## Recommendation

Do **phase 0 then phase 1** together — phase 1 alone is a takeover vector, and phase 0 alone is
useful anyway (a verified email is what makes support replies and notifications reliable). Phase 1
itself is roughly 15 lines and carries no data-loss risk, since it creates nothing and deletes
nothing.

Do **2a** next: it is small, and turns the remaining case into something support can resolve.

Defer **2b/3** until duplicates actually accumulate. Not because the safety is unclear — with
phase 0 in place the verification story is settled in both directions, and `linkPhone` already
proves phone ownership at the right moment — but because the *merge itself* is where the risk is.
Repointing twelve relations, deduping favourites, resolving a 1:1 `outreachContact` and taking the
more generous of two paid entitlements is the part that can silently destroy someone's listings.
With 4 users, a hand-run merge is cheaper and safer than a self-service flow carrying that bug
surface.

## Out of scope

- Merging two **Google** accounts, or two phone numbers — not possible to detect, and not what
  users hit.
- Changing an already-set email. `updateProfile` deliberately refuses (`Email is already set`) so
  a Google-verified address cannot be overwritten from the form.
- Account deletion / GDPR erasure, which overlaps with merge mechanics but is its own feature.
