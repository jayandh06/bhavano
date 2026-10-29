/** The Campaign and Ad group choices on the admin Page visits screen. Built from the ad ids actually seen on visits plus the known names (apps/bff/src/ads/campaign-names.ts),
 * so a campaign or ad group with no visits yet still appears and an id with no name still appears as its number. */
export interface PageVisitAdOptionsDto {
    campaigns: {
        id: string;
        name: string;
        visits: number;
    }[];
    adGroups: {
        id: string;
        name: string;
        campaignId: string | null;
        campaignName: string | null;
        visits: number;
    }[];
}
