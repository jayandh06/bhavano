import { rolloutBucket } from "@bhavano/types/loginNudge";

/** Which version of the post-ad Details form a visitor sees. `v1` is the long-standing form; `v2` is the redesign in
 * docs/plans/post-ad-simpler-form.md, rolled out gradually so the admin funnel can compare the two (the variant is written
 * into every funnel event as `form=`). */
export type PostFormVariant = "v1" | "v2";

export function parsePostFormVariant(value: unknown): PostFormVariant | null {
  return value === "v1" || value === "v2" ? value : null;
}

/** The rollout percentage from the server's `POST_FORM_V2_PERCENT` setting: a whole number from 0 to 100, and 0 (nobody) for
 * anything missing or unparseable, so a typo can never switch the new form on for everyone. */
export function parseRolloutPercent(raw: string | undefined): number {
  if (raw === undefined || !/^\s*\d{1,3}\s*$/.test(raw)) return 0;
  return Math.min(100, Number(raw));
}

/** `override` (the `?form=` query param, for testing) wins; otherwise the visitor's stable bucket decides, so the same
 * browser keeps the same form across visits. Without a viewer key there is no bucket, so only 100% includes them. */
export function resolvePostFormVariant(input: {
  override: PostFormVariant | null;
  percent: number;
  viewerKey: string;
}): PostFormVariant {
  if (input.override) return input.override;
  if (input.percent >= 100) return "v2";
  if (input.percent <= 0 || !input.viewerKey) return "v1";
  return rolloutBucket(input.viewerKey) < input.percent ? "v2" : "v1";
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
