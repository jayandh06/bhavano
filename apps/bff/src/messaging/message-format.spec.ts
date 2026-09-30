import { bhavanoSitePath, normalizeUrlForOpening, segmentMessageBody } from '@bhavano/types/messageFormat';
import { staffThreadTag } from '@bhavano/types/conversationTag';

const urls = (body: string) => segmentMessageBody(body).filter((s) => s.type === 'url').map((s) => s.value);

describe('segmentMessageBody', () => {
  it('links http(s) and www. URLs, without trailing punctuation', () => {
    expect(urls('See https://example.com/foo?a=1. And www.example.org!')).toEqual([
      'https://example.com/foo?a=1',
      'www.example.org',
    ]);
  });

  it('links a bare bhavano.com address, with or without a path', () => {
    expect(urls('Boost your ad from the bhavano.com/my-listings page.')).toEqual(['bhavano.com/my-listings']);
    expect(urls('Thank you for listing on Bhavano.com.')).toEqual(['Bhavano.com']);
    expect(urls('Try m.bhavano.com/help')).toEqual(['m.bhavano.com/help']);
  });

  it('leaves an email address and look-alike domains alone', () => {
    expect(urls('Write to support@bhavano.com')).toEqual([]);
    expect(urls('not notbhavano.com or bhavano.community or bhavano.com.au')).toEqual([]);
  });

  it('turns an HTML link into its real URL, dropping the label and tags', () => {
    const segments = segmentMessageBody('Open <a href="https://bhavano.com/plans" target="_blank">our plans</a> now');
    expect(segments).toEqual([
      { type: 'text', value: 'Open ' },
      { type: 'url', value: 'https://bhavano.com/plans' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('never links a non-http HTML link', () => {
    expect(urls('<a href="javascript:alert(1)">x</a>')).toEqual([]);
  });

  it('keeps the text between links, including newlines', () => {
    const body = 'Hello,\n\nVisit bhavano.com/my-listings\nThanks';
    expect(segmentMessageBody(body).map((s) => s.value).join('')).toBe(body);
  });
});

describe('normalizeUrlForOpening', () => {
  it('adds https:// only when there is no scheme', () => {
    expect(normalizeUrlForOpening('bhavano.com/my-listings')).toBe('https://bhavano.com/my-listings');
    expect(normalizeUrlForOpening('http://x.com')).toBe('http://x.com');
  });
});

describe('bhavanoSitePath', () => {
  it('returns the path for Bhavano links and null for anything else', () => {
    expect(bhavanoSitePath('bhavano.com/my-listings')).toBe('/my-listings');
    expect(bhavanoSitePath('https://www.bhavano.com/messages?x=1')).toBe('/messages?x=1');
    expect(bhavanoSitePath('Bhavano.com')).toBe('/');
    expect(bhavanoSitePath('https://bhavano.com.evil.example/x')).toBeNull();
    expect(bhavanoSitePath('https://example.com/bhavano.com')).toBeNull();
  });
});

describe('staffThreadTag', () => {
  it('names each kind of staff thread and leaves buyer inquiries untagged', () => {
    expect(staffThreadTag('moderation')).toBe('Bhavano · Listing review');
    expect(staffThreadTag('announcement')).toBe('Bhavano · Boost offer');
    expect(staffThreadTag('inquiry')).toBeNull();
  });
});
