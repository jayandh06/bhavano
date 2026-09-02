# Choosing a cover photo, and letting owners manage their own photos

**Status: built.** This document originally proposed swapping `photoNo` directly to change the
cover photo — that turned out to be wrong (see "The flaw caught before building" below) and was
corrected to a separate `displayOrder` field before anything shipped.

## Short answer: yes, straightforward

There was no "cover photo" flag before this — the first photo shown on a browse card and at the
top of the detail gallery was simply whichever `ListingPhoto` row had the lowest `photoNo`. "Set
the cover photo" is now "give this photo a `displayOrder` lower than every other photo on the
listing" — a new, purely-ordering field, decoupled from `photoNo`.

### The flaw caught before building

The first draft of this plan proposed swapping the target photo's `photoNo` with whatever was at
`photoNo: 1`. That's wrong: `photoNo` is baked into this photo's **storage keys**
(`photos/{listingId}_{photoNo}_{variant}.webp`, see `apps/bff/src/uploads/photo-keys.ts`). Swapping
it in the database would desync "which row the DB thinks is at position 1" from "which R2 objects
actually hold that photo's bytes" — the row now claiming `photoNo: 1` would generate a URL that
still serves the *other* photo's pixels, since nothing about R2's actual contents moved.

Fixed by adding `ListingPhoto.displayOrder` (migration
`20260902110000_listing_photo_display_order`) as a field with **no** identity or storage
meaning — purely "where does this show in the gallery." It defaults to `photoNo` at creation (so
every existing photo's order is unchanged), and `set-cover` just gives the target the current
minimum `displayOrder` minus one:

```ts
// ListingPhotosService — the actual shipped implementation
private async setCover(listingId: string, photoNo: number) {
  const photos = await this.prisma.listingPhoto.findMany({ where: { listingId }, select: { photoNo: true, displayOrder: true } });
  const target = photos.find((p) => p.photoNo === photoNo);
  if (!target) throw new NotFoundException(...);
  const minOrder = Math.min(...photos.map((p) => p.displayOrder));
  if (target.displayOrder === minOrder) return { displayOrder: target.displayOrder }; // already the cover
  const displayOrder = minOrder - 1;
  await this.prisma.listingPhoto.update({ where: { listingId_photoNo: { listingId, photoNo } }, data: { displayOrder } });
  return { displayOrder };
}
```

No transaction, no sentinel value, no uniqueness constraint on `displayOrder` at all — ties are
broken by `photoNo` as a secondary sort key (`listingPhotos: { orderBy: [{ displayOrder: 'asc' },
{ photoNo: 'asc' }] }`), and since every "set cover" strictly decreases the minimum, a genuine tie
can never occur in practice. `photoNo` itself, and every storage key derived from it, is never
touched — no reprocessing, no cache purge, no R2 activity at all for a cover change.

## What shipped

**Shared logic**: `ListingPhotosService` (`apps/bff/src/listings/listing-photos.service.ts`), not
grown into either `AdminService` or the already-1300-line `ListingsService` — resolved open
question 1 this way. `rotate`/`setCover` are private; each has an `*AsAdmin` (no ownership check)
and `*AsOwner` (ownership enforced) public wrapper, rather than one method with an optional
"skip the check" flag — a flag like that is exactly the kind of thing a call site could pass wrong
and fail silently open. Registered in `ListingsModule`, exported so `AdminModule` (which already
imports `ListingsModule`) picks it up with no new cross-module wiring.

**Routes**:
- Admin (existing pattern, `AdminGuard`): `POST /admin/listings/:id/photos/:photoNo/rotate`,
  `POST /admin/listings/:id/photos/:photoNo/set-cover`.
- Owner (new, `AuthGuard` + ownership check inside the service):
  `POST /listings/:id/photos/:photoNo/rotate`, `POST /listings/:id/photos/:photoNo/set-cover`.

**Admin UI**: `RotatablePhotoGrid` gained a "☆ Cover" button, top-left (rotate stays top-right),
shown on every photo except index 0 — no separate "is this the cover" field needed client-side,
since the photos array already arrives ordered by `displayOrder`. Instant: no local-preview step
like rotate has, since there's nothing ambiguous to preview.

**Owner UI**: `/my-listings/:id/edit` (`EditListingForm`) gained a new `EditListingPhotos`
section — a from-scratch Tailwind rebuild of the same rotate-preview/save and set-cover
interaction, not a copy of the admin component (which is styled for the admin app's own
plain-inline-style convention and doesn't belong in this app's design system).

## The three other open questions, resolved

- **Rate limiting**: none added. Each save is already batched to one reprocess regardless of how
  many local preview clicks preceded it, so the abuse surface is no worse than any other
  already-unlimited owner-facing mutation (`updateListing`, `deleteVideo`). Revisit only if it's
  actually abused.
- **Mobile parity**: web-only for this pass. `apps/mobile` gets the same capability as a follow-up,
  not bundled in — building a second (React Native) UI for the same interaction was a big enough
  lift to warrant shipping web first and confirming the design holds up before duplicating it.
- **Scope**: cover-only, as originally asked — not a full drag-to-reorder grid. If reordering the
  rest of the gallery (not just picking what's first) turns out to be wanted too, `displayOrder`
  already supports it with no further schema change; only the UI (and a slightly more general
  service method than "always go to the current minimum") would need building.
