import { ServiceUnavailableException } from '@nestjs/common';
import { GooglePlacesNearbyLandmarksProvider } from './google-places-landmarks.provider';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';

function makeProvider(apiKey: string | undefined = 'test-places-key') {
  const config = { get: jest.fn().mockReturnValue(apiKey) } as unknown as ConfigService;
  const callLogger = { info: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
  const provider = new GooglePlacesNearbyLandmarksProvider(config, callLogger);
  return { provider, config, callLogger };
}

function mockFetchOk(places: { displayName?: { text?: string } }[]): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ places })),
  }) as unknown as typeof fetch;
}

describe('GooglePlacesNearbyLandmarksProvider', () => {
  it('throws if GOOGLE_MAPS_SERVER_KEY is not configured', async () => {
    const { provider } = makeProvider(undefined);

    await expect(provider.findNearby(12.9, 77.6)).rejects.toThrow(ServiceUnavailableException);
  });

  it('builds the request with the api key header, field mask, and a circle around the pin', async () => {
    mockFetchOk([]);
    const { provider } = makeProvider('real-key');

    await provider.findNearby(12.9, 77.6);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchNearby',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'real-key', 'X-Goog-FieldMask': 'places.displayName' }),
      }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.locationRestriction.circle.center).toEqual({ latitude: 12.9, longitude: 77.6 });
  });

  it('returns deduplicated real place names from the response', async () => {
    mockFetchOk([
      { displayName: { text: 'Lulu Mall' } },
      { displayName: { text: 'St. Mary School' } },
      { displayName: { text: 'Lulu Mall' } },
    ]);
    const { provider } = makeProvider();

    const names = await provider.findNearby(12.9, 77.6);

    expect(names).toEqual(['Lulu Mall', 'St. Mary School']);
  });

  it('degrades to an empty list input for the caller when the response has no places', async () => {
    mockFetchOk([]);
    const { provider } = makeProvider();

    expect(await provider.findNearby(12.9, 77.6)).toEqual([]);
  });

  it('throws ServiceUnavailableException on a non-OK response, for the caller to catch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('{}'),
    }) as unknown as typeof fetch;
    const { provider } = makeProvider();

    await expect(provider.findNearby(12.9, 77.6)).rejects.toThrow(ServiceUnavailableException);
  });
});
