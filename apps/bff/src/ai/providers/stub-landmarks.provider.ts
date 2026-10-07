import { Injectable } from '@nestjs/common';
import type { NearbyLandmarksProvider } from './nearby-landmarks.provider';

/** Deterministic, no-network stand-in — see StubListingCopyProvider's own doc comment for why
 * this exists. Returns a small fixed fake list so the "landmarks found" path is exercisable in
 * dev/CI without a real Places call; a test that wants to exercise the "no landmarks" path
 * should mock/override this provider directly rather than relying on this default. */
@Injectable()
export class StubLandmarksProvider implements NearbyLandmarksProvider {
  async findNearby(_lat: number, _lng: number): Promise<string[]> {
    return ['Stub Central Mall', 'Stub Public School', 'Stub Bus Depot'];
  }
}
