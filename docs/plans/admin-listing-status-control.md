# Admin: change a listing's status without touching the database directly

## Context

Investigating why listing `666d5039-...` was deactivated found it was the owner's own deliberate
action — but reactivating it required a direct production database write, because **there is no
admin path to change a listing's `status`** (active/sold/rented/deactivated). The app's own
`ListingsService.update()` explicitly throws `ForbiddenException` for anyone who isn't the
listing's owner, and the existing admin listing endpoints only ever touch `moderationState`
(flag/approve), never `status`. This closes that gap the same way `flag`/`approve` already work,
so the next time this comes up it's a button, not a `psql` session.

## Design, following the existing flag/approve convention exactly

`flagListing`/`approveListing` (`apps/bff/src/admin/admin.service.ts:126-160`) never change a
listing silently — each posts a message into the owner-facing moderation thread explaining what
happened, via the same `messagingService.getOrCreateModerationThread` +
`messagingService.sendMessage` used for flag/approve. `setListingStatus` follows the identical
shape: the owner always sees *why* their listing's status changed, in the same thread they
already use to talk to admins. No new push/SMS/WhatsApp notification type — flag/approve's
notifications exist because they signal "your listing needs attention"; a status correction is a
transparency/audit matter, adequately served by the thread message alone (scoped out here to keep
this proportionate to what was asked).

## 1. `apps/bff/src/admin/dto/set-listing-status.dto.ts` (new)

```ts
import { IsIn } from 'class-validator';
import type { ListingStatus } from '@bhavano/types';

const STATUSES: ListingStatus[] = ['active', 'sold', 'rented', 'deactivated'];

export class SetListingStatusDto {
  @IsIn(STATUSES)
  status!: ListingStatus;
}
```

## 2. `apps/bff/src/listings/listings.service.ts` — new `setStatusAsAdmin()`

Mirrors `flag()`/`approve()` (lines 428-453) exactly — a direct `prisma.listing.update()`, no
owner check (that's the whole point):

```ts
async setStatusAsAdmin(id: string, status: ListingStatus): Promise<ListingDetailDto> {
  const listing = await this.prisma.listing.update({
    where: { id },
    data: { status },
    include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
  });
  return this.toDetailDto(listing, undefined, true);
}
```

## 3. `apps/bff/src/admin/admin.service.ts` — new `setListingStatus()`

Right after `approveListing()` (line 160), same shape:

```ts
async setListingStatus(id: string, status: ListingStatus, adminId: string): Promise<ListingDetailDto> {
  const listing = await this.listingsService.setStatusAsAdmin(id, status);
  const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
  await this.messagingService.sendMessage(thread.id, adminId, `Status changed to "${status}" by an admin.`);
  return listing;
}
```

## 4. `apps/bff/src/admin/admin.controller.ts` — new endpoint

Right after `approveListing` (line 78), same shape as `setReviewed`/`flagListing`:

```ts
@Patch('listings/:id/status')
setListingStatus(
  @Param('id') id: string,
  @Body() dto: SetListingStatusDto,
  @CurrentUser() user: RequestUser,
): Promise<ListingDetailDto> {
  return this.adminService.setListingStatus(id, dto.status, user.id);
}
```

## 5. `apps/admin/src/lib/bff.ts` — new `setListingStatus()`

Mirrors `setReviewed` (the function backing `setReviewedAction`) — same
`authedBffFetch`/`PATCH` shape, just a different path and body.

## 6. `apps/admin/src/app/actions/admin.ts` — new `setListingStatusAction()`

Mirrors `setReviewedAction` (lines 20-30) exactly: `requireAdmin()`, call the new lib function,
`revalidatePath("/")` + `revalidatePath(`/listings/${listingId}`)`, try/catch into `ActionResult`.

## 7. `apps/admin/src/components/ModerationPanel.tsx` — new control

Add a `status: ListingStatus` prop. New small control in the existing button row (next to "Mark
reviewed"/"Flag"/"Approve"): a `<select>` of the 4 status values (defaulting to the current one) +
an "Update status" button, calling `setListingStatusAction(listingId, selected)` — same
`pending`/`error` state already wired up in this component, no new state pattern needed.

## 8. `apps/admin/src/app/listings/[id]/page.tsx`

Pass `status={listing.status}` into `<ModerationPanel>` (line 123) alongside the existing props.

## Verification

1. `pnpm --filter bff typecheck` / `build`, `pnpm --filter admin typecheck` / `build` all pass.
2. On the admin listing detail page, change a test listing's status via the new control — confirm
   the DB row updates, a message appears in the moderation thread explaining the change, and the
   page reflects the new status after the action completes (via `revalidatePath`).
3. Confirm a non-admin request to `PATCH /admin/listings/:id/status` is rejected by the existing
   `AdminGuard` on the controller (no new guard needed — it's already applied at the controller
   level, same as every other endpoint here).
