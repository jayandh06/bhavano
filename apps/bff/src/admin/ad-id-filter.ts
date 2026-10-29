import type { Prisma } from '@prisma/client';

/** The Campaign / Ad group filter on Page visits: a comma-separated list of Google Ads ids, where
 * the word `none` stands for "not from an ad" (a null column). A single id — the shape links
 * shared before the filter took several — is just a list of one. Returns undefined for an empty
 * value, so the caller applies no clause at all. */
export function adIdClause(field: 'campaignId' | 'adGroupId', raw: string | undefined): Prisma.VisitWhereInput | undefined {
  const parts = (raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const ids = parts.filter((p) => p !== 'none');
  const wantsNone = ids.length !== parts.length;
  if (ids.length === 0) return { [field]: null };
  if (!wantsNone) return { [field]: { in: ids } };
  return { OR: [{ [field]: { in: ids } }, { [field]: null }] };
}
