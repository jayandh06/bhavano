import { FacebookProvider } from './facebook.provider';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';

function makeProvider(env: Record<string, string | undefined> = {}) {
  const config = {
    get: (key: string) =>
      ({
        FACEBOOK_PAGE_ID: '123456',
        FACEBOOK_PAGE_ACCESS_TOKEN: 'page-token',
        ...env,
      })[key],
  } as unknown as ConfigService;
  const callLogger = {
    info: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
  return { provider: new FacebookProvider(config, callLogger), callLogger };
}

function mockFetch(body: string, ok = true, status = ok ? 200 : 400) {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({ ok, status, text: async () => body });
  global.fetch = fetchMock;
  return fetchMock;
}

describe('FacebookProvider.publishListing', () => {
  it('posts a link card to the configured Page feed and returns the post id', async () => {
    const fetchMock = mockFetch('{"id":"123456_789"}');
    const { provider } = makeProvider();

    const result = await provider.publishListing(
      '2 BHK for rent\n₹25,000 · Koramangala, Bengaluru',
      'https://www.bhavano.com/bengaluru/koramangala/rent-lease/apartment/2bhk-abc123',
    );

    expect(result).toBe('123456_789');
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://graph.facebook.com/v23.0/123456/feed');
    const payload = JSON.parse(init.body);
    expect(payload).toEqual({
      message: '2 BHK for rent\n₹25,000 · Koramangala, Bengaluru',
      link: 'https://www.bhavano.com/bengaluru/koramangala/rent-lease/apartment/2bhk-abc123',
      access_token: 'page-token',
    });
  });

  it('uses FACEBOOK_API_VERSION when set, instead of the default', async () => {
    const fetchMock = mockFetch('{"id":"123456_789"}');
    const { provider } = makeProvider({ FACEBOOK_API_VERSION: 'v99.0' });

    await provider.publishListing('msg', 'https://www.bhavano.com/x');

    expect(fetchMock.mock.calls[0][0] as string).toBe(
      'https://graph.facebook.com/v99.0/123456/feed',
    );
  });

  it('falls back to the default version when FACEBOOK_API_VERSION is an empty string', async () => {
    const fetchMock = mockFetch('{"id":"123456_789"}');
    const { provider } = makeProvider({ FACEBOOK_API_VERSION: '' });

    await provider.publishListing('msg', 'https://www.bhavano.com/x');

    expect(fetchMock.mock.calls[0][0] as string).toBe(
      'https://graph.facebook.com/v23.0/123456/feed',
    );
  });

  it.each([
    ['page id', { FACEBOOK_PAGE_ID: undefined }],
    ['access token', { FACEBOOK_PAGE_ACCESS_TOKEN: undefined }],
  ])('skips without posting when the %s is unset', async (_label, env) => {
    const fetchMock = mockFetch('{"id":"123456_789"}');
    const { provider } = makeProvider(env);

    const result = await provider.publishListing(
      'msg',
      'https://www.bhavano.com/x',
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('returns false rather than throwing on a non-2xx response', async () => {
    mockFetch('{"error":{"message":"Invalid OAuth access token"}}', false);
    const { provider } = makeProvider();

    const result = await provider.publishListing(
      'msg',
      'https://www.bhavano.com/x',
    );

    expect(result).toBe(false);
  });

  it('returns false rather than throwing on a success status with no post id', async () => {
    mockFetch('{"error":{"message":"missing permission"}}', true);
    const { provider } = makeProvider();

    const result = await provider.publishListing(
      'msg',
      'https://www.bhavano.com/x',
    );

    expect(result).toBe(false);
  });

  it('returns false rather than throwing when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const { provider } = makeProvider();

    const result = await provider.publishListing(
      'msg',
      'https://www.bhavano.com/x',
    );

    expect(result).toBe(false);
  });

  describe('configured', () => {
    it('is true when both the page id and access token are set', () => {
      expect(makeProvider().provider.configured).toBe(true);
    });

    it('is false when either is missing', () => {
      expect(
        makeProvider({ FACEBOOK_PAGE_ID: undefined }).provider.configured,
      ).toBe(false);
      expect(
        makeProvider({ FACEBOOK_PAGE_ACCESS_TOKEN: undefined }).provider
          .configured,
      ).toBe(false);
    });
  });
});
