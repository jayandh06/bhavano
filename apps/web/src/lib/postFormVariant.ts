import { rolloutBucket } from "@bhavano/types/loginNudge";

/** Which version of the post-ad Details form a visitor sees. `v1` is the long-standing form; `v2` is the redesign in
 * docs/plans/post-ad-simpler-form.md, rolled out gradually so the admin funnel can compare the two (the variant is written
 * into every funnel event as `form=`); `v3` is v2 with the details shown step by step on one page (sections appear as the one above
 * is completed). v3 is shown to admins and by `?form=v3`; the rollout percentage never assigns it. */
export type PostFormVariant = "v1" | "v2" | "v3";

/** What the funnel records as `form=` for a session. Admins are always shown v3, but their sessions are labelled `admin` so staff testing
 * never counts towards the v1 / v2 / v3 comparison. */
export type PostFormTrackLabel = PostFormVariant | "admin";

export function parsePostFormVariant(value: unknown): PostFormVariant | null {
  return value === "v1" || value === "v2" || value === "v3" ? value : null;
}

/** The rollout share from the admin setting: a whole number from 0 to 100, and 0 (nobody) for anything else, so a bad value can never
 * switch the new form on for everyone. */
export function normalizeRolloutPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Admins get the newest form, `v3`, by default (so the team uses the latest design), and can pick any version with `override` (the `?form=`
 * query param; the post page has a switch for it). For everyone else `override` wins too, for testing; otherwise the visitor's stable bucket
 * decides, so the same browser keeps the same form across visits. Without a viewer key there is no bucket, so only 100% includes them. */
export function resolvePostFormVariant(input: {
  isAdmin?: boolean;
  override: PostFormVariant | null;
  percent: number;
  viewerKey: string;
}): PostFormVariant {
  if (input.override) return input.override;
  if (input.isAdmin) return "v3";
  if (input.percent >= 100) return "v2";
  if (input.percent <= 0 || !input.viewerKey) return "v1";
  return rolloutBucket(input.viewerKey) < input.percent ? "v2" : "v1";
}

/** The `form=` value to record for a session: `admin` for admins, otherwise the version they were shown. */
export function postFormTrackLabel(variant: PostFormVariant, isAdmin: boolean): PostFormTrackLabel {
  return isAdmin ? "admin" : variant;
}

const POST_FORM_KEY = "bhavano.postFormKey";

/** A random id kept in this browser, used only to bucket the visitor. Empty when storage is unavailable (private mode),
 * which resolves to `v1`: better to show the known form than to flip between versions on every visit. */
export function getPostFormViewerKey(): string {
  try {
    const existing = localStorage.getItem(POST_FORM_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(POST_FORM_KEY, created);
    return created;
  } catch {
    return "";
  }
}
