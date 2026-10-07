export const NEARBY_LANDMARKS_PROVIDER = 'NEARBY_LANDMARKS_PROVIDER';

/** Real nearby place names for a pin — Featured tier only (see `AiService`), since this is the
 * single most expensive call in the whole pipeline. Implementations must return only places a
 * real lookup actually found; never a guessed/plausible name. */
export interface NearbyLandmarksProvider {
  findNearby(lat: number, lng: number): Promise<string[]>;
}
