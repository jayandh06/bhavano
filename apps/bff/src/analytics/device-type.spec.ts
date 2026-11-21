import { osFromUserAgent } from './device-type';

describe('osFromUserAgent for the native app', () => {
  it('reads the React Native HTTP stacks, but only for app requests', () => {
    expect(osFromUserAgent('okhttp/4.12.0', true)).toBe('android');
    expect(osFromUserAgent('Bhavano/22 CFNetwork/1494.0.7 Darwin/23.4.0', true)).toBe('ios');
    expect(osFromUserAgent('okhttp/4.12.0')).toBeNull();
    expect(osFromUserAgent('Bhavano/22 CFNetwork/1494.0.7 Darwin/23.4.0', false)).toBeNull();
  });

  it('still prefers a browser-style UA, and stays null when nothing matches', () => {
    expect(osFromUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7)', true)).toBe('android');
    expect(osFromUserAgent('curl/8.0', true)).toBeNull();
    expect(osFromUserAgent(undefined, true)).toBeNull();
  });
});

describe('osFromUserAgent', () => {
  it('recognises an Android User-Agent', () => {
    expect(
      osFromUserAgent(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('android');
  });

  it('recognises an iPhone User-Agent', () => {
    expect(
      osFromUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios');
  });

  it('recognises an iPad User-Agent', () => {
    expect(
      osFromUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('ios');
  });

  it('returns null for a desktop User-Agent', () => {
    expect(
      osFromUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBeNull();
  });

  it('returns null when no User-Agent was sent at all', () => {
    expect(osFromUserAgent(undefined)).toBeNull();
  });
});
