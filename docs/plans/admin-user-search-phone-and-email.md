# Admin user search: phone/email didn't match a pasted value

## Status: fixed 2026-09-29

## Report

"Allow user admin screen to search user by phone number as well" → clarified: "by phone number or
email as well along with Name" → "I tried but didn't work for phone and email."

## Root cause (verified against production data)

The Users admin screen's search box (`AdminService.listUsers`) and the owner type-ahead used by the
Listings/Logins/Page-visits filter bars (`AdminService.searchUsers`) both already matched name,
phone **and** email — that part has worked since the Users list first shipped
(2026-09-07). The actual bug: `listUsers` never trimmed `q` before using it in a Postgres `contains`
(`LIKE '%q%'`), so a query with a leading/trailing space or a trailing newline matched nothing, even
though the value itself was correct.

That distinction — "works for name, not for phone/email" — is exactly what a whitespace bug looks
like in practice: a name is usually typed by hand, a phone number or email is usually **pasted**
(from a contact card, a spreadsheet, WhatsApp), and that route is what leaves the stray whitespace.
Reproduced directly against production: `phone: { contains: ' 9487643797 ' }` (a real, currently
active phone number with a padding space) matched 0 rows; the same query trimmed matched 1.

## Fix

New shared helper, `apps/bff/src/admin/user-search.ts`'s `buildUserSearchOr`, used by both
`listUsers` and `searchUsers` (previously each had its own copy of the OR clause):

1. **Trims the query** — fixes the reported bug outright.
2. **Also normalizes phone-shaped queries.** `User.phone` is always stored as a bare 10-digit
   string (verified: 0 rows contain `+`, a space or a dash), but a pasted number often isn't —
   country code, parentheses, dashes and all. A query made only of digits and phone punctuation
   (`+()-.` and spaces — never letters or `@`, so this can't misfire on a name or email) is reduced
   to its bare digits, with a leading `91`/`+91` country code or a leading trunk `0` dropped, and
   also matched against `phone`. `"+91 94876 43797"`, `"(948) 764-3797"` and `"094876 43797"` now
   all find the same row as the bare `"9487643797"` would.

Verified against real rows on production (read-only): all five reported-broken shapes — a
padded phone, a padded email, a country-code-prefixed phone, a punctuated phone, and a
trunk-0-prefixed phone — now match; an ordinary query's behavior is unchanged.

## Not changed

- Storage format (still a bare 10-digit string) — normalization happens only in the search, not in
  `User.phone` itself.
- `ListUsersDto.q` validation (`@IsString()` already accepts anything, including whitespace).
