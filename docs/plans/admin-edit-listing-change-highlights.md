# Admin Edit listing: green and red change highlights

Status: built 5 Nov 2026.

**What:** on `/listings/[id]/edit`, every field the admin has changed but not yet saved shows what the edit adds (green) and removes (red) against the saved value, so a long description or a multi-select can be checked before Save.

**How it reads**
- Title and Description: word-by-word diff in a small box (`diffWords`, `apps/admin/src/lib/textDiff.ts`); removed words red with a strike-through, added words green.
- Multi-select amenities and Specs: chips, `+ added` green and `− removed` red (`diffList`).
- Everything else (category, transaction, status, city, area, pin, price, qualifier, selects, numbers, Yes/No toggles): the old value struck through in red, an arrow, the new value in green. A value that was empty shows only green; one cleared shows only red.
- Nothing is shown for a field equal to its saved value, and the notes vanish after Save (the page refreshes with the new saved values).

**Where:** `ChangeNote` (`apps/admin/src/components/ChangeNote.tsx`), placed under each field in `AdminEditListingForm`. Colours use `--green` and `--danger`, so light and dark themes both work.

**Not covered:** the area-unit dropdown next to an area field (a unit-only change shows no note), and photos (the admin form has no photo editing).

**Edit history too (asked 5 Nov 2026):** each logged change on the listing page's history tab uses the same notes (`HistoryChange` in `listings/[id]/page.tsx`), so a past edit reads as green added and red removed instead of `old → new` text.
