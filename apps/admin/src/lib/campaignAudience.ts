import type { CampaignAudienceFilter, City } from "@bhavano/types";

/** Builds the audience filter saved on a campaign. Keys with nothing chosen are omitted rather than
 * stored empty (an absent filter means "any", and an empty one reads as a mistake later). Fields
 * these forms don't edit — minRating, statuses — are carried over from `base` untouched. */
export function buildAudienceFilter(
  base: CampaignAudienceFilter | undefined,
  chosen: { tags: string[]; categories: string[]; cityIds: string[] },
): CampaignAudienceFilter {
  const { tags: _t, businessCategories: _b, cityIds: _c, ...kept } = base ?? {};
  return {
    ...kept,
    ...(chosen.tags.length > 0 ? { tags: chosen.tags } : {}),
    ...(chosen.categories.length > 0 ? { businessCategories: chosen.categories } : {}),
    ...(chosen.cityIds.length > 0 ? { cityIds: chosen.cityIds } : {}),
  };
}

export function parseTags(text: string): string[] {
  return text.split(",").map((t) => t.trim()).filter(Boolean);
}

/** One line for the campaign card, e.g. "categories real_estate_agent · cities Bengaluru, Chennai ·
 * tags portal-agent". Returns "no audience set" for an empty filter, which is the state that can't
 * be activated. City ids that no longer resolve are shown as-is rather than dropped. */
export function describeAudience(filter: CampaignAudienceFilter | undefined, cities: City[]): string {
  const parts: string[] = [];
  if (filter?.businessCategories?.length) parts.push(`categories ${filter.businessCategories.join(", ")}`);
  if (filter?.cityIds?.length) {
    const names = filter.cityIds.map((id) => cities.find((c) => c.id === id)?.name ?? id);
    parts.push(`cities ${names.join(", ")}`);
  }
  if (filter?.tags?.length) parts.push(`tags ${filter.tags.join(", ")}`);
  if (filter?.minRating != null) parts.push(`rating ≥ ${filter.minRating}`);
  if (filter?.statuses?.length) parts.push(`status ${filter.statuses.join(", ")}`);
  return parts.length > 0 ? parts.join(" · ") : "no audience set";
}
