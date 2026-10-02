import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

// Their JWKS client is ESM-only, which this Jest setup can't load; refresh never uses them.
jest.mock('./providers/apple.provider', () => ({ AppleProvider: class {} }));
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

const SECRET = 'test-secret';

function makeService(user: Record<string, unknown> | null, activeId = 'u1') {
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const config = { get: jest.fn().mockReturnValue(SECRET) };
  const accountMerge = { resolveActiveUserId: jest.fn().mockResolvedValue(activeId) };
  const noop = {} as never;
  const service = new AuthService(
    prisma as never,
    config as never,
    noop,
    noop,
    accountMerge as never,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
  );
  return { service, prisma, accountMerge };
}

function lifetimeDays(token: string): number {
  const { iat, exp } = jwt.verify(token, SECRET) as { iat: number; exp: number };
  return (exp - iat) / 86_400;
}

describe('AuthService.refresh', () => {
  it('issues a 30-day token to a user and a 90-day token to an admin', async () => {
    const user = await makeService({ id: 'u1', role: 'user', deletedAt: null }).service.refresh('u1');
    expect(lifetimeDays(user.accessToken!)).toBe(30);
    const admin = await makeService({ id: 'u1', role: 'admin', deletedAt: null }).service.refresh('u1');
    expect(lifetimeDays(admin.accessToken!)).toBe(90);
  });

  it('renews for the surviving account after a merge', async () => {
    const { service, prisma } = makeService({ id: 'winner', role: 'user', deletedAt: null }, 'winner');
    const session = await service.refresh('loser');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'winner' } });
    expect((jwt.verify(session.accessToken!, SECRET) as { sub: string }).sub).toBe('winner');
  });

  it('refuses a deleted or missing account', async () => {
    await expect(
      makeService({ id: 'u1', role: 'user', deletedAt: new Date() }).service.refresh('u1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(makeService(null).service.refresh('u1')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
