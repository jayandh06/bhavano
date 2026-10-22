import { postFieldEventPath, type PostFieldEvent } from "@bhavano/types/postFieldEvents";

/** One field-level event on the wizard's Details step, written as a synthetic page visit so admin's Page visits
 * trail and the post-funnel "blocked at Preview" table can read it (same trick as `postActionTrail.ts`). Carries a
 * target name and the category only, never anything the seller typed. Best-effort and fire-and-forget: a dropped
 * write must never affect the form. See docs/plans/post-details-step-experience.md, Phase 0. */
export function reportPostFieldEvent(
  event: PostFieldEvent,
  detail?: { field?: string | null; category?: string | null; ms?: number; left?: number },
) {
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: postFieldEventPath(event, detail) }),
    keepalive: true,
  }).catch(() => {
    // Offline or navigated away mid-flight.
  });
}
