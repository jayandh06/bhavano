import { slugify } from "@bhavano/types/slugify";
import type { PostEntrySource } from "@bhavano/types/postEntry";

/** Builds every internal `/post` link's href — a `?city=` preselect (unchanged behavior) plus
 * `?from=<slug>` so the admin funnel can tell which on-site link sent the visitor here. See
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. One place for this instead of
 * six near-identical ternaries, so a future query param never has to be added in six places. */
export function postHref(cityName: string | null | undefined, from: PostEntrySource): string {
  const params = new URLSearchParams({ from });
  if (cityName) params.set("city", slugify(cityName));
  return `/post?${params.toString()}`;
}
