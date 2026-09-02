# Choosing a cover photo, and letting owners manage their own photos

## Short answer: yes, straightforward either way

There's no "cover photo" flag anywhere today — the first photo shown on a browse card and at the
top of the detail gallery is simply whichever `ListingPhoto` row has the lowest `photoNo`
(`listingPhotos: { orderBy: { photoNo: 'asc' } }` in `listings.service.ts`, used unchanged by both
`toCardDto` and `toDetailDto`). No new field, no DTO change, no consumer update needed — "set the
cover photo" is just **"make this photo's `photoNo` the lowest one."**

The simplest correct way to do that: **swap** the target photo's `photoNo` with whatever is
currently at `photoNo: 1`, rather than renumbering the whole sequence. A full drag-to-reorder
grid is more UI than the actual ask ("pick which one shows first") needs — a single "Make cover"
button per photo covers it. Swapping two rows' `photoNo` under `@@unique([listingId, photoNo])`
needs a temporary sentinel value inside a transaction (Postgres will reject setting one row to a
value the other still holds), same shape as any two-row unique-constraint swap:

```ts
async setCoverPhoto(listingId: string, photoNo: number) {
  await this.prisma.$transaction(async (tx) => {
    const target = await tx.listingPhoto.findUniqueOrThrow({ where: { listingId_photoNo: { listingId, photoNo } } });
    if (target.photoNo === 1) return; // already the cover
    const current = await tx.listingPhoto.findUniqueOrThrow({ where: { listingId_photoNo: { listingId, photoNo: 1 } } });
    await tx.listingPhoto.update({ where: { id: target.id }, data: { photoNo: -1 } }); // sentinel, dodges the unique constraint
    await tx.listingPhoto.update({ where: { id: current.id }, data: { photoNo: target.photoNo } });
    await tx.listingPhoto.update({ where: { id: target.id }, data: { photoNo: 1 } });
  });
}
```

No reprocessing needed — `photoNo` is only ever an ordering key, never part of what
`PhotoProcessingService` renders, so a swap is instant, no R2/CDN/cache concerns like the rotate
feature has (variant *keys* do embed `photoNo`, so the swap does mean photo A's `full`/`preview`
files effectively "become" what's served at photo B's old URLs and vice versa — but since nothing
about their *content* changed, and both were already fully processed, there's nothing stale to
purge; the existing files just get referenced under swapped numbers).

## Where this belongs for admin

Same place as rotate: `RotatablePhotoGrid` gets a second button per photo, "Make cover" (only
shown on photos that aren't already `photoNo === 1`), calling a new
`POST /admin/listings/:id/photos/:photoNo/set-cover`. No local-preview step needed here (unlike
rotate) — there's nothing to preview, the swap is unambiguous and instant.

## The bigger ask: letting the owner do this themselves

Today, once a listing is posted, **the owner has zero photo management** — `/my-listings/:id/edit`
doesn't touch photos at all; the only photo interaction anywhere in the owner's flow is
add/remove *during initial posting* (`PostAdWizard.tsx`), with no reordering even then. Rotate and
set-cover exist only for admins, on the moderation page. This plan extends both to the owner, on
their own edit page.

### API: shared logic, two gates

Rather than duplicating `rotatePhoto`/`setCoverPhoto` between `AdminService` and `ListingsService`,
move both into `ListingsService` (or a new focused `ListingPhotosService`, if `ListingsService` —
already 1300+ lines — shouldn't grow further; worth deciding before building, not a call to make
unilaterally). Two thin controller routes call the same service method:

- **Admin** (existing pattern): `POST /admin/listings/:id/photos/:photoNo/rotate`, gated by
  `AdminGuard` — no ownership check, an admin can act on any listing.
- **Owner** (new): `POST /listings/:id/photos/:photoNo/rotate`, gated by the regular auth guard
  plus an explicit ownership check —
  `if (listing.ownerId !== user.id) throw new ForbiddenException(...)`, the exact pattern already
  used for every other owner-only listing mutation (`updateListing`, `deleteVideo`, etc. in
  `listings.service.ts`).

Same split for `set-cover`. The admin routes keep working exactly as they do today; this is
additive, not a replacement.

### UI: a web component, not a port of the admin one

`RotatablePhotoGrid` is styled for the admin app's plain-inline-style convention and lives in
`apps/admin`. The owner-facing version needs its own component in `apps/web` using this app's
actual design system (Tailwind, the same visual language as `PostAdWizard`'s own photo thumbnails)
— not a copy-paste, a rebuild of the same *interaction* (local preview via CSS `transform`, one
"Save" commits every pending turn in one call, per
`docs/plans/listing-photo-orientation.md`'s "preview vs save" section) in the app's own idiom.
Goes on `/my-listings/:id/edit`, likely as a new section alongside the existing price/title/specs
fields.

### Open questions to settle before building

1. **Where does the shared rotate/set-cover logic live** — stays in `AdminService` and
   `ListingsService` calls into it (inverts today's natural admin→listings dependency direction,
   probably wrong), moves to `ListingsService` (grows an already-large file), or a new
   `ListingPhotosService` both controllers depend on? Leaning toward the third, but worth
   confirming.
2. **Any limit on how often an owner can rotate/re-cover?** Admin has no rate limit today since
   admins are trusted and few. An owner-facing endpoint is a new surface reachable by every seller
   — probably fine to leave unlimited given each save is already batched to one reprocess
   regardless of preview clicks, but worth a deliberate "yes, unlimited" rather than an accidental
   one.
3. **Mobile app parity** — `apps/mobile` posts and views listings too. Does this ship web-only
   first, or does mobile need the same edit-page capability in the same pass? Affects scope
   significantly since it's a second UI to build, not just a second consumer of the same API.
4. **Should non-cover-photo reordering (not just "which one is first") be a future follow-up?**
   This plan deliberately scopes to "pick the cover," not a full drag-to-reorder grid — worth
   confirming that's the right scope and not an under-build of what's actually wanted.
