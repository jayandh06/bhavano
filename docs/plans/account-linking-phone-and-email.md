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
  if (byEmail) {
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

### 2b. Verified self-service merge

Only offer merge once **both** identifiers are proven in the same session:

1. User is logged into account A and enters an identifier belonging to account B
2. They verify it — OTP for a phone, emailed code/link for an email
3. Both proven, so both accounts belong to them, and the merge may proceed

**Never merge without step 2.** Without it, entering a stranger's phone number claims their
account.

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

Do **phase 1** now — it is roughly 15 lines, removes the most likely duplicate path, and carries
no risk of data loss because it creates nothing and deletes nothing.

Do **2a** next: it is small, and turns the remaining case into something support can resolve.

Defer **2b/3** until duplicates actually accumulate. With 4 users, a hand-run merge is cheaper and
safer than a self-service flow that could destroy listings if it has a bug.

## Out of scope

- Merging two **Google** accounts, or two phone numbers — not possible to detect, and not what
  users hit.
- Changing an already-set email. `updateProfile` deliberately refuses (`Email is already set`) so
  a Google-verified address cannot be overwritten from the form.
- Account deletion / GDPR erasure, which overlaps with merge mechanics but is its own feature.
