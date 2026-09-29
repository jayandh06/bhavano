import type { Prisma } from '@prisma/client';

/** A trimmed query made only of digits and the punctuation a phone number is typically typed or
 * pasted with — `+`, spaces, dashes, parentheses, dots. A name or email never matches this (an
 * email always has an `@`; a name has letters), so this only ever fires for something that looks
 * like a phone number. */
const PHONE_LIKE = /^[+()\-.\s\d]+$/;

/** `User.phone` is always stored as a bare 10-digit string (verified in production — no `+91`,
 * spaces or dashes ever land in it), but an admin searching for one rarely types it that way: it
 * gets pasted from a contact card, a spreadsheet, or WhatsApp, country code and all. This
 * strips everything but the digits and drops a leading `91` (with or without the `+` that
 * preceded it) or a leading trunk `0`, so "+91 94876 43797", "9194876 43797" and "094876-43797"
 * all still find the bare 10-digit row. Returns `undefined` for anything that isn't phone-shaped,
 * or that reduces to fewer than 3 digits — too short to be a phone fragment and long enough that
 * every row would match, which is a scan, not a search. */
function digitsForPhoneMatch(query: string): string | undefined {
  if (!PHONE_LIKE.test(query)) return undefined;
  let digits = query.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 3 ? digits : undefined;
}

/**
 * The name/phone/email search shared by every admin "find a user" surface — the Users list's own
 * filter (`AdminService.listUsers`) and the owner type-ahead that filters Listings/Logins/Page
 * visits by user (`AdminService.searchUsers`). See docs/plans/admin-user-search-phone-and-email.md.
 *
 * Returns `undefined` for "nothing to search on", the caller's cue to leave the field out of the
 * `where` entirely rather than filtering on an empty `OR: []` (which Prisma/Postgres would read as
 * "match nothing", not "match everything").
 *
 * **Trims first.** A phone number or email is usually pasted in, not typed — from a contact card,
 * a spreadsheet, a WhatsApp chat — and that route routinely carries a leading/trailing space or a
 * trailing newline. Postgres `LIKE` matches that space literally, so a search for a real,
 * correctly-spelled phone number or email returned nothing; a hand-typed name rarely has the same
 * problem, which is why "search works for the name but not the phone or email" was the reported
 * shape of the bug rather than "search is broken".
 */
export function buildUserSearchOr(q: string | undefined): Prisma.UserWhereInput[] | undefined {
  const query = q?.trim();
  if (!query) return undefined;

  const phoneDigits = digitsForPhoneMatch(query);
  return [
    { name: { contains: query, mode: 'insensitive' } },
    { phone: { contains: query } },
    // Only added when it says something the raw query doesn't already — a plain 10-digit paste
    // has phoneDigits === query, and repeating the same clause would just be dead weight.
    ...(phoneDigits && phoneDigits !== query ? [{ phone: { contains: phoneDigits } }] : []),
    { email: { contains: query, mode: 'insensitive' } },
  ];
}
