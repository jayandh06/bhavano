# Mask phones in listing title and description

Sellers paste WhatsApp / mobile numbers into the listing title or description to bypass
contact-reveal. On create and on every owner/admin edit, free-text fields are scrubbed before
persist so the stored value never publishes a full Indian mobile.

## Behaviour

- `apps/bff/src/listings/scrub-listing-phones.ts` finds Indian mobiles (bare 10 digits, leading
  `0`, `+91` / `91`, optional spaces / dashes / dots) and replaces each with the same mask used
  in third-party call logs (`98******10` via `maskPhone`).
- Applied in `ListingsService.create` and `ListingsService.applyUpdate` (owner `update` and
  admin `updateAsAdmin`). The edit log records the scrubbed "after" value.
- Prices, pincodes, and short codes are left alone. Existing listings are unchanged until edited.
- Photos are out of scope here (needs OCR); see the earlier product discussion.

## Verification

```
pnpm --filter bff test -- scrub-listing-phones
```
