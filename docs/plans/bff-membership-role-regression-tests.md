# BFF regression tests: user roles + membership tiers

## Context

Bhavano recently merged a large monetization/membership feature set (Bhavano Plus buyer
premium, Agent Pro, Seller Slot Pack, boosted listings — see
`docs/plans/monetization-boosted-listings-premium-tiers.md` and
`docs/plans/listing-slots-seller-notifications.md`) alongside the existing `UserRole`
(`user`/`admin`) split. This logic is scattered across several services as ad-hoc
`premiumUntil`/`agentProUntil`/`sellerSlotPackUntil`/`boostedUntil` timestamp checks, each
gating a different feature (listing slot caps, video upload limits, saved-search alerts,
messaging badges, agent storefronts, admin access). None of it has automated test coverage
today — `apps/bff` has jest configured (`pnpm --filter @bhavano/bff test`) but the only
existing spec is the default Nest-scaffold `app.controller.spec.ts`. The goal is to lock in
the current, correct behavior for every user-type × membership-tier combination so future
changes to this code can't silently regress a paying tier's entitlement or leak a paid
feature to a free user.

Per user's choice: **BFF unit tests only** — Jest + `@nestjs/testing`, mocked `PrismaService`
(no real Postgres, no e2e/supertest, no frontend Playwright checks in this pass).

## Confirmed gating surfaces (read directly from current code, not the aspirational plan docs)

| Surface | File | Dimension | Current behavior |
|---|---|---|---|
| `listingSlotAllowance()` | `packages/types/src/listingSlots.ts:28` | free / sellerSlotPack / agentPro×units | free=5, sellerSlotPack=10, agentPro = `max(1, agentProUnits) * 20`, `Math.max` across all three; `isActive()` boundary is a strict `>` against `Date.now()` |
| `ListingSlotsService.assertCanPublish()` | `apps/bff/src/listing-slots/listing-slots.service.ts:47` | same tiers | throws `ForbiddenException` with `ListingSlotCapErrorBody` (`upsell: ['sellerSlotPack','agentPro']` if allowance<10, else `['agentPro']`) once `activeCount >= allowance` |
| `resolveVideoEntitlement()` | `packages/types/src/videoLimits.ts:39` | agentPro (user) OR boosted (listing) | either one active ⇒ `VIDEO_LIMITS.elevated` + `canUpgradeByBoosting:false`; neither ⇒ `.default` + `canUpgradeByBoosting:true` |
| `ListingsService.acceptVideosForOwner()` / `addVideo()` | `apps/bff/src/listings/listings.service.ts:419,432` | agentPro / boosted | filters/trims videos to entitlement at create; `addVideo` throws `BadRequestException` (message branches on `canUpgradeByBoosting`) once at cap, or if duration exceeds `maxDurationSec` |
| `ListingsService.toggleFavourite()` | `listings.service.ts:629` | `listing.boostedUntil` | owner gets a like-notification only when the liked listing is currently boosted |
| `SavedSearchesService.create()` | `apps/bff/src/saved-searches/saved-searches.service.ts:35` | `user.premiumUntil` | `ForbiddenException` unless `premiumUntil` is set **and** strictly in the future |
| `SavedSearchesService.notifyMatchingBuyers()` | same file, `:74` | `premiumUntil` | Prisma `where` already filters candidates to `premiumUntil: { gt: now }`; only matching ones get notified |
| `AgentsService.getStorefront()` | `apps/bff/src/agents/agents.service.ts:17` | `agentProUntil` | `isAgentPro` boolean = strictly-future `agentProUntil`; `NotFoundException` if user missing |
| `MessagingService.listConversations()` | `apps/bff/src/messaging/messaging.service.ts:48` | `premiumUntil` (of the *inquirer*) | `otherPartyIsVerifiedBuyer` true only when viewer is the **poster** and the inquirer's `premiumUntil` is active; always `false` from the inquirer's own side, even if they themselves are premium |
| `AuthGuard` / `OptionalAuthGuard` / `AdminGuard` | `apps/bff/src/auth/guards/auth.guard.ts` | `UserRole` (`user`/`admin`) + token validity | `AuthGuard` throws `UnauthorizedException` with no/invalid Bearer token; `OptionalAuthGuard` never throws, leaves `request.user` undefined for anonymous; `AdminGuard` additionally throws `ForbiddenException` when `role !== 'admin'` |

## Test files to add

One spec per service/module, colocated next to the file it tests (existing repo convention),
using `Test.createTestingModule({ providers: [Service, { provide: PrismaService, useValue: mockPrisma }, ...] })`
with `jest.fn()`-based mocks — no real DB. Dates are computed relative to a fixed reference
(e.g. `Date.now()`) with explicit past/future offsets rather than hardcoded ISO strings, so tests
never become time-bomb flaky.

1. **`apps/bff/src/listing-slots/listing-slots.service.spec.ts`**
   - `listingSlotAllowance` matrix (via the service's `getSummary`): free user → 5; sellerSlotPack
     active → 10; agentPro active, `agentProUnits` 1/3/undefined/0 → 20/60/20/20 (clamped); both
     sellerSlotPack + agentPro active → the higher of the two; every tier with an **expired**
     `*Until` timestamp → falls back to free (5).
   - `assertCanPublish`: passes when `activeCount < allowance`; throws `ForbiddenException` with
     correct `upsell` array when at/over cap for a free user (`['sellerSlotPack','agentPro']`) vs.
     a sellerSlotPack user already at 10 (`['agentPro']` only, since allowance is not <10).

2. **`apps/bff/src/listings/listings.service.spec.ts`** (new — service not currently under test)
   - Video entitlement matrix via `acceptVideosForOwner`/`addVideo`: free+unboosted → default
     limits; agentPro active+unboosted → elevated; free+boosted listing → elevated (boost alone
     is enough); agentPro **expired**+boosted → still elevated (boost still active); both expired
     → default. Assert `addVideo`'s thrown message differs (upsell copy vs. flat "maximum" copy)
     based on `canUpgradeByBoosting`.
   - `toggleFavourite`: owner-notify call fires only when `listing.boostedUntil` is active;
     confirm it's skipped for an unboosted listing and for the owner liking their own listing.

3. **`apps/bff/src/saved-searches/saved-searches.service.spec.ts`**
   - `create()`: throws `ForbiddenException` for `premiumUntil: null`, expired, and missing user;
     succeeds for active `premiumUntil`.
   - `notifyMatchingBuyers()`: given a mixed set of matching saved searches from
     premium/expired/never-subscribed users, only the active-premium ones get
     `notificationsService.notifySavedSearchMatch` called and `lastNotifiedAt` updated.

4. **`apps/bff/src/agents/agents.service.spec.ts`**
   - `getStorefront()`: `isAgentPro` true for active `agentProUntil`, false for expired/null;
     `NotFoundException` when the user doesn't exist.

5. **`apps/bff/src/messaging/messaging.service.spec.ts`**
   - `listConversations()`: `otherPartyIsVerifiedBuyer` true only for the poster viewing a
     conversation where the inquirer has active `premiumUntil`; false when viewed from the
     inquirer's own side (even if the inquirer is premium); false when the inquirer's
     `premiumUntil` is expired/null; false for a `moderation`-type conversation.

6. **`apps/bff/src/auth/guards/auth.guard.spec.ts`**
   - Build a fake `ExecutionContext` wrapping a mock request/JWT secret (via a stub
     `ConfigService`). Cases: valid `user`-role token passes `AuthGuard`/`OptionalAuthGuard`;
     valid `admin`-role token passes all three guards; missing header → `AuthGuard`/`AdminGuard`
     throw `UnauthorizedException`, `OptionalAuthGuard` leaves `request.user` undefined; malformed/
     expired JWT → same unauthorized behavior; valid `user`-role token on `AdminGuard` →
     `ForbiddenException`.

## Verification

- `pnpm --filter @bhavano/bff test` — all new specs green, no impact on the existing
  `app.controller.spec.ts`.
- `pnpm --filter @bhavano/bff typecheck` (mocks must satisfy the real service constructor
  signatures/Prisma types, not `any`-cast past them).

## Explicitly out of scope (per user's answer)

- e2e/supertest specs against a live test database.
- Any Playwright/frontend checks for premium-gated UI (Verified Buyer badge, Plans page,
  storefront badge rendering).
- `packages/types` gets no new test tooling of its own — its pure helpers
  (`listingSlotAllowance`, `resolveVideoEntitlement`) are exercised indirectly through the BFF
  service specs above, which already import them exactly as production code does.
