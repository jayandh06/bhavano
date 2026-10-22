/** Field-level events on the posting wizard's Details step, recorded as synthetic page visits so they show up
 * in admin's Page visits trail and feed the post-funnel "blocked at Preview" table (Phase 0 of
 * docs/plans/post-details-step-experience.md). Same trick as `/post/action` and `/post/error`.
 *
 * Path: `/post/field?event=<name>&field=<target>&category=<category>[&ms=<n>][&left=<n>]`. Deliberately not under
 * `/post/details` or `/post/category`: the funnel counts sessions by path prefix, and an event must not read as
 * another arrival at a step. Only a target name and a category travel, never what the seller typed. */
export const POST_FIELD_EVENTS = [
  /** First time the seller touched a field on Details. `ms` is the time since the step opened. */
  "first_touch",
  /** Tapped Preview with things left. `field` is the first thing blocking, `left` how many remain. */
  "preview_blocked",
  /** Tapped the "N left" chip. */
  "chip_tapped",
  /** Left the step by any route other than Preview. `field` is the last thing touched, `ms` how long they stayed. */
  "details_exit",
] as const;

export type PostFieldEvent = (typeof POST_FIELD_EVENTS)[number];

export const POST_FIELD_PATH_PREFIX = "/post/field";

const SAFE = /^[A-Za-z0-9:_.-]{1,60}$/;

export function postFieldEventPath(
  event: PostFieldEvent,
  detail: { field?: string | null; category?: string | null; ms?: number; left?: number } = {},
): string {
  const parts = [`event=${event}`];
  if (detail.field && SAFE.test(detail.field)) parts.push(`field=${encodeURIComponent(detail.field)}`);
  if (detail.category && SAFE.test(detail.category)) parts.push(`category=${encodeURIComponent(detail.category)}`);
  if (detail.ms !== undefined && Number.isFinite(detail.ms)) parts.push(`ms=${Math.max(0, Math.round(detail.ms))}`);
  if (detail.left !== undefined && Number.isFinite(detail.left)) parts.push(`left=${Math.max(0, Math.round(detail.left))}`);
  return `${POST_FIELD_PATH_PREFIX}?${parts.join("&")}`;
}

export interface ParsedPostFieldEvent {
  event: PostFieldEvent;
  field: string | null;
  category: string | null;
  ms: number | null;
  left: number | null;
}

/** Reads a `/post/field` path back, or null when it is not a well-formed one. */
export function parsePostFieldEventPath(path: string): ParsedPostFieldEvent | null {
  if (!path.startsWith(POST_FIELD_PATH_PREFIX)) return null;
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    try {
      params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      return null;
    }
  }
  const event = params.event;
  if (!event || !(POST_FIELD_EVENTS as readonly string[]).includes(event)) return null;
  const num = (name: string) => (params[name] !== undefined && /^\d{1,9}$/.test(params[name]) ? Number(params[name]) : null);
  return {
    event: event as PostFieldEvent,
    field: params.field ?? null,
    category: params.category ?? null,
    ms: num("ms"),
    left: num("left"),
  };
}

/** A target as a readable label for admin: "attr:carpetAreaSqft" becomes "carpetAreaSqft", "photos" stays. */
export function postFieldTargetLabel(target: string | null): string {
  if (!target) return "(none)";
  return target.startsWith("attr:") ? target.slice("attr:".length) : target;
}
