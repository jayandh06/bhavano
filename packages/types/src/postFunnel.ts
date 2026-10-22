/** One step of the `/post` posting-wizard funnel — see AdminService.getPostFunnel and
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Ordered: each step's
 * `sessions` is a subset of the previous one's (a session reaching Details necessarily reached
 * Category first), except `/post` itself, which can undercount slightly under an `entry`/
 * `loggedIn` filter — see that doc's own note on why. */
export interface PostFunnelStepDto {
  /** The real or synthetic PageView path this step counts — `/post`, `/post/category`, etc. */
  path: string;
  label: string;
  sessions: number;
  /** null for the first step, which has nothing to compare against. */
  pctOfPrevious: number | null;
}

export interface PostFunnelDto {
  steps: PostFunnelStepDto[];
}

/** One row of the "what blocks Preview" table: how often a field was the first thing in the way when a seller
 * tapped Preview with things left. */
export interface PostDetailsBlockerDto {
  /** The target name from `postDetailsIssues`: `location`, `price`, `photos`, `title`, ..., or `attr:<field key>`. */
  field: string;
  category: string | null;
  /** Distinct sessions this blocked at least once. */
  sessions: number;
  /** Total blocked Preview taps. */
  taps: number;
}

/** Where sellers stalled: the last field touched in sessions that left Details without going on to Preview. */
export interface PostDetailsExitDto {
  field: string | null;
  sessions: number;
  /** Median seconds spent on Details by those sessions. */
  medianSeconds: number | null;
}

/** Field-level view of the Details step (docs/plans/post-details-step-experience.md, Phase 0), built from the
 * `/post/field` events the wizards write. */
export interface PostDetailsBlockersDto {
  /** Sessions that opened Details / that went on to Preview, in the same window, for the conversion figure. */
  sessionsAtDetails: number;
  sessionsAtPreview: number;
  /** Sessions that touched any field on Details. */
  sessionsTouched: number;
  /** Sessions that tapped Preview while something was left. */
  sessionsBlocked: number;
  /** Median seconds from opening Details to the first field touched. */
  medianSecondsToFirstTouch: number | null;
  blockers: PostDetailsBlockerDto[];
  exits: PostDetailsExitDto[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Turns raw `/post/field` events into the blockers and exits tables. `events` are the PageView rows (session id +
 * path); malformed paths are ignored. A session counts as having *exited* only if it sent `details_exit` and never
 * reached Preview (`previewSessionIds`). */
export function summarizePostFieldEvents(
  events: { sessionId: string; path: string }[],
  parse: (path: string) => { event: string; field: string | null; category: string | null; ms: number | null } | null,
  previewSessionIds: ReadonlySet<string>,
): Pick<PostDetailsBlockersDto, "sessionsTouched" | "sessionsBlocked" | "medianSecondsToFirstTouch" | "blockers" | "exits"> {
  const touched = new Set<string>();
  const blocked = new Set<string>();
  const firstTouchMs: number[] = [];
  const blockerMap = new Map<string, { field: string; category: string | null; sessions: Set<string>; taps: number }>();
  const exitMap = new Map<string, { field: string | null; sessions: Set<string>; ms: number[] }>();

  for (const { sessionId, path } of events) {
    const e = parse(path);
    if (!e) continue;
    if (e.event === "first_touch") {
      touched.add(sessionId);
      if (e.ms !== null) firstTouchMs.push(e.ms);
    } else if (e.event === "preview_blocked") {
      blocked.add(sessionId);
      const field = e.field ?? "(unknown)";
      const key = `${field}|${e.category ?? ""}`;
      const row = blockerMap.get(key) ?? { field, category: e.category, sessions: new Set<string>(), taps: 0 };
      row.sessions.add(sessionId);
      row.taps += 1;
      blockerMap.set(key, row);
    } else if (e.event === "details_exit" && !previewSessionIds.has(sessionId)) {
      const key = e.field ?? "";
      const row = exitMap.get(key) ?? { field: e.field, sessions: new Set<string>(), ms: [] };
      row.sessions.add(sessionId);
      if (e.ms !== null) row.ms.push(e.ms);
      exitMap.set(key, row);
    }
  }

  const firstTouch = median(firstTouchMs);
  return {
    sessionsTouched: touched.size,
    sessionsBlocked: blocked.size,
    medianSecondsToFirstTouch: firstTouch === null ? null : Math.round(firstTouch / 1000),
    blockers: [...blockerMap.values()]
      .map((r) => ({ field: r.field, category: r.category, sessions: r.sessions.size, taps: r.taps }))
      .sort((a, b) => b.sessions - a.sessions || b.taps - a.taps)
      .slice(0, 20),
    exits: [...exitMap.values()]
      .map((r) => {
        const m = median(r.ms);
        return { field: r.field, sessions: r.sessions.size, medianSeconds: m === null ? null : Math.round(m / 1000) };
      })
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20),
  };
}
