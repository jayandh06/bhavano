import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClientErrorDto } from './create-client-error.dto';

async function validateDto(input: Record<string, unknown>) {
  const dto = plainToInstance(CreateClientErrorDto, input);
  return validate(dto);
}

describe('CreateClientErrorDto', () => {
  it('accepts a minimal report with only the required fields', async () => {
    const errors = await validateDto({
      app: 'web',
      message: 'TypeError: x is not a function',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a full report with every optional field populated', async () => {
    const errors = await validateDto({
      app: 'mobile',
      message: 'Rendering error',
      stack: 'Error: Rendering error\n  at Component (App.tsx:10:5)',
      componentStack: 'in Component\n  in App',
      url: '/post',
      digest: 'abc123',
      userAgent: 'Mozilla/5.0',
      appVersion: '1.0.0',
      userId: 'user-1',
      ip: '203.0.113.5',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an app value outside the known three', async () => {
    const errors = await validateDto({ app: 'desktop', message: 'x' });
    expect(errors.some((e) => e.property === 'app')).toBe(true);
  });

  it('rejects a missing message', async () => {
    const errors = await validateDto({ app: 'web' });
    expect(errors.some((e) => e.property === 'message')).toBe(true);
  });

  it('rejects a stack trace over the 8000-character cap', async () => {
    const errors = await validateDto({
      app: 'web',
      message: 'x',
      stack: 'a'.repeat(8001),
    });
    expect(errors.some((e) => e.property === 'stack')).toBe(true);
  });

  it('rejects a message over the 500-character cap', async () => {
    const errors = await validateDto({ app: 'web', message: 'a'.repeat(501) });
    expect(errors.some((e) => e.property === 'message')).toBe(true);
  });

  it('rejects an ip that is not a valid IP address', async () => {
    const errors = await validateDto({
      app: 'web',
      message: 'x',
      ip: 'not-an-ip',
    });
    expect(errors.some((e) => e.property === 'ip')).toBe(true);
  });
});
