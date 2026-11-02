import type { PageVisitDto, PageVisitHighlights, PageVisitSessionLogin } from '@bhavano/types';

/** How many of the newest matching visits "Group by user" looks at. Grouping happens in memory so pagination can count users
 * rather than sessions; the cap keeps a wide date range cheap, and the page says when it applied. */
export const PAGE_VISIT_GROUP_SCAN_CAP = 5000;

export interface ScannedVisit {
  id: string;
  userId: string | null;
}

export interface VisitGroup {
  /** The account's id, or the visit's own id for a visit nobody logged in on, which stays a row of its own. */
  key: string;
  /** Visit ids, in the order they were scanned (newest activity first). */
  ids: string[];
}

/** Groups visits by the account they are linked to. `visits` must already be newest activity first; groups come back in the order
 * their newest visit appears, so the list stays newest first without a second sort. */
export function groupVisitsByUser(visits: ScannedVisit[]): VisitGroup[] {
  const groups = new Map<string, VisitGroup>();
  for (const v of visits) {
    const key = v.userId ?? `visit:${v.id}`;
    const group = groups.get(key);
    if (group) group.ids.push(v.id);
    else groups.set(key, { key, ids: [v.id] });
  }
  return [...groups.values()];
}

const adRank = { live: 2, pipeline: 1 } as const;
const featuredRank = { active: 2, past: 1 } as const;

/** The strongest of each highlight across a person's sessions. */
export function mergeHighlights(all: (PageVisitHighlights | undefined)[]): PageVisitHighlights | undefined {
  const present = all.filter((h): h is PageVisitHighlights => !!h);
  if (present.length === 0) return undefined;
  let ad: PageVisitHighlights['ad'] = null;
  let featured: PageVisitHighlights['featured'] = null;
  let requirement: PageVisitHighlights['requirement'] = null;
  for (const h of present) {
    if (h.requirement === 'open' || (h.requirement === 'closed' && requirement === null)) requirement = h.requirement;
    if (h.ad && (!ad || adRank[h.ad] > adRank[ad])) ad = h.ad;
    if (h.featured && (!featured || featuredRank[h.featured] > featuredRank[featured])) featured = h.featured;
  }
  return {
    ad,
    featured,
    requirement,
    purchased: present.some((h) => h.purchased),
    activePurchase: present.some((h) => h.activePurchase),
  };
}

/** Folds one account's sessions into a single row. The row keeps the first session's details (how the person arrived: source,
 * campaign, device, landing page, IP), starts when the first session started, was last active when the newest one was, and adds up
 * the page views. `groupedSessionIds` lists every session so the page can open one combined trail. A single session is returned
 * as it came. */
export function mergeVisitGroup(items: PageVisitDto[]): PageVisitDto {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = sorted[0];
  if (sorted.length === 1) return first;

  const logins: PageVisitSessionLogin[] = [];
  for (const item of sorted) {
    for (const login of item.sessionLogins) {
      if (!logins.some((l) => l.userId === login.userId)) logins.push(login);
    }
  }
  const lastActivity = sorted.map((i) => i.lastActivityAt ?? i.createdAt).sort().at(-1) as string;

  return {
    ...first,
    lastActivityAt: lastActivity,
    pageViewCount: sorted.reduce((sum, i) => sum + i.pageViewCount, 0),
    sessionLogins: logins,
    highlights: mergeHighlights(sorted.map((i) => i.highlights)),
    groupedSessionIds: sorted.map((i) => i.sessionId),
  };
}
