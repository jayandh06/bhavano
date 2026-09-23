import { maskEmail, maskPhone, maskUrlParam, scrubResponseText } from './thirdPartyCallLogger';

describe('maskPhone', () => {
  it('keeps the first two and last two digits, masking the middle', () => {
    expect(maskPhone('9876543210')).toBe('98******10');
  });

  it('masks a short value entirely rather than exposing it whole', () => {
    expect(maskPhone('123')).toBe('***');
  });
});

describe('maskEmail', () => {
  it('keeps only the first character of the local part and the whole domain', () => {
    expect(maskEmail('seller@example.com')).toBe('s***@example.com');
  });

  it('falls back to full masking for a string with no @', () => {
    expect(maskEmail('not-an-email')).toBe('*'.repeat('not-an-email'.length));
  });
});

describe('maskUrlParam', () => {
  it('replaces a query param value, leaving the rest of the URL intact', () => {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=12,77&key=AIzaSyReal&language=en';
    const masked = maskUrlParam(url, 'key');
    expect(masked).toContain('key=***');
    expect(masked).not.toContain('AIzaSyReal');
    expect(masked).toContain('latlng=12%2C77');
  });

  it('is a no-op when the param is absent', () => {
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Koramangala';
    expect(maskUrlParam(url, 'key')).toBe(new URL(url).toString());
  });

  it('returns the original string rather than throwing on an unparseable URL', () => {
    expect(maskUrlParam('not a url', 'key')).toBe('not a url');
  });
});

describe('scrubResponseText', () => {
  it('masks a phone number (with its country-code prefix) embedded in otherwise-plain text', () => {
    const text = '{"status":"success","to":"919876543210"}';
    const scrubbed = scrubResponseText(text);
    expect(scrubbed).not.toContain('9876543210');
    expect(scrubbed).toContain('91********10');
  });

  it('masks an email address embedded in response text', () => {
    const scrubbed = scrubResponseText('{"contact":"buyer@example.com"}');
    expect(scrubbed).not.toContain('buyer@example.com');
    expect(scrubbed).toContain('b***@example.com');
  });

  it('leaves a message id and other non-PII fields fully readable', () => {
    // Real MSG91 response shape — message id must survive untouched, since it's the one thing
    // extractMessageId is checked against (see the provider's own comment).
    const text = '{"message":"success","data":[{"message_id":"3fa1c2b9e0d84a1c8f6e2b7a1d9c0f3e"}]}';
    expect(scrubResponseText(text)).toBe(text);
  });

  it('does not mistake a 6-digit OTP for a phone number', () => {
    const text = '{"otp_sent":"482913"}';
    expect(scrubResponseText(text)).toBe(text);
  });
});
