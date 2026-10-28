import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { getEmailLoginMode } from './login-settings';

// Their JWKS client is ESM-only, which this Jest setup can't load.
jest.mock('./providers/apple.provider', () => ({ AppleProvider: class {} }));
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

function makeService(opts: { mode?: string; existingByGoogleId?: Record<string, unknown> | null; byEmail?: Record<string, unknown> | null; adminEmails?: string }) {
  const prisma = {
    loginSetting: { findUnique: jest.fn().mockResolvedValue(opts.mode ? { emailLogin: opts.mode } : null) },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: Record<string, string> }) =>
        Promise.resolve(where.googleId || where.appleId ? (opts.existingByGoogleId ?? null) : (opts.byEmail ?? null)),
      ),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const config = { get: jest.fn().mockImplementation((k: string) => (k === 'ADMIN_EMAILS' ? opts.adminEmails : undefined)) };
  const google = { verifyIdToken: jest.fn().mockResolvedValue({ googleId: 'g1', email: 'a@b.com', name: 'A' }) };
  const noop = {} as never;
  const service = new AuthService(prisma as never, config as never, noop, noop, noop, google as never, noop, noop, noop, noop, noop, noop, noop);
  return { service, prisma };
}

const gate = (service: AuthService, mode: string, isStaff: boolean, existing: boolean) =>
  (service as unknown as { assertEmailLoginOpen: (m: string, s: boolean, e: boolean) => void }).assertEmailLoginOpen(mode, isStaff, existing);

describe('email login switch', () => {
  it('"all" lets everyone through', () => {
    const { service } = makeService({});
    expect(() => gate(service, 'all', false, false)).not.toThrow();
  });

  it('"existing_only" lets an existing account in but refuses a new one', () => {
    const { service } = makeService({});
    expect(() => gate(service, 'existing_only', false, true)).not.toThrow();
    expect(() => gate(service, 'existing_only', false, false)).toThrow(ForbiddenException);
  });

  it('the migration mode lets in only existing accounts that have no mobile number', () => {
    const { service } = makeService({});
    const migrate = (staff: boolean, existing: boolean, hasPhone: boolean) =>
      (service as unknown as { assertEmailLoginOpen: (m: string, s: boolean, e: boolean, p: boolean) => void }).assertEmailLoginOpen('existing_no_phone', staff, existing, hasPhone);
    expect(() => migrate(false, true, false)).not.toThrow();
    expect(() => migrate(false, true, true)).toThrow(ForbiddenException);
    expect(() => migrate(false, false, false)).toThrow(ForbiddenException);
    expect(() => migrate(true, true, true)).not.toThrow();
  });

  it('with the migration mode, an existing Google account that has a phone is refused (it signs in with the OTP from now on)', async () => {
    const { service, prisma } = makeService({ mode: 'existing_no_phone', existingByGoogleId: { id: 'u1', role: 'user', phone: '9876543210' } });
    await expect(service.loginWithGoogle('token')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('"off" refuses everyone except staff', () => {
    const { service } = makeService({});
    expect(() => gate(service, 'off', false, true)).toThrow(ForbiddenException);
    expect(() => gate(service, 'off', true, true)).not.toThrow();
  });

  it('refuses a brand-new Google sign-up while only existing accounts are allowed, before creating anything', async () => {
    const { service, prisma } = makeService({ mode: 'existing_only' });
    await expect(service.loginWithGoogle('token')).rejects.toMatchObject({ response: { code: 'EMAIL_LOGIN_DISABLED' } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses an existing Google account when the switch is off', async () => {
    const { service, prisma } = makeService({ mode: 'off', existingByGoogleId: { id: 'u1', role: 'user' } });
    await expect(service.loginWithGoogle('token')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('treats an unproven typed-in address as a new account, not an existing one', async () => {
    const { service, prisma } = makeService({ mode: 'existing_only', byEmail: { id: 'u2', role: 'user', emailVerifiedAt: null } });
    await expect(service.loginWithGoogle('token')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps staff able to sign in with Google when it is off (the admin app uses it)', async () => {
    const { service, prisma } = makeService({ mode: 'off', existingByGoogleId: { id: 'u1', role: 'admin' } });
    // Past the gate it goes on into the normal login; with no other services wired that fails later, but never with the switch's 403.
    await expect(service.loginWithGoogle('token')).rejects.not.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('falls back to "all" when the setting cannot be read', async () => {
    const prisma = { loginSetting: { findUnique: jest.fn().mockRejectedValue(new Error('no table')) } };
    await expect(getEmailLoginMode(prisma as never)).resolves.toBe('all');
  });
});
