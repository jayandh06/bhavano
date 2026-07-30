import * as jwt from 'jsonwebtoken';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AdminGuard, AuthGuard, OptionalAuthGuard } from './auth.guard';

const SECRET = 'test-secret';

function makeConfig(): ConfigService {
  return { get: jest.fn().mockReturnValue(SECRET) } as unknown as ConfigService;
}

function makeContext(authorization?: string): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function bearerFor(sub: string, role?: 'user' | 'admin') {
  return `Bearer ${jwt.sign({ sub, role }, SECRET)}`;
}

describe('AuthGuard — role: user', () => {
  it('passes and attaches request.user for a valid user token', () => {
    const { context, request } = makeContext(bearerFor('u1', 'user'));
    const guard = new AuthGuard(makeConfig());
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({ id: 'u1', role: 'user' });
  });

  it('throws UnauthorizedException with no Authorization header', () => {
    const { context } = makeContext();
    const guard = new AuthGuard(makeConfig());
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a malformed/invalid token', () => {
    const { context } = makeContext('Bearer not-a-real-jwt');
    const guard = new AuthGuard(makeConfig());
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a token signed with a different secret', () => {
    const { context } = makeContext(`Bearer ${jwt.sign({ sub: 'u1', role: 'user' }, 'wrong-secret')}`);
    const guard = new AuthGuard(makeConfig());
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('defaults role to "user" when the JWT payload omits it', () => {
    const { context, request } = makeContext(`Bearer ${jwt.sign({ sub: 'u1' }, SECRET)}`);
    const guard = new AuthGuard(makeConfig());
    guard.canActivate(context);
    expect(request.user).toEqual({ id: 'u1', role: 'user' });
  });
});

describe('OptionalAuthGuard — never blocks anonymous traffic', () => {
  it('leaves request.user undefined for an anonymous caller (no header)', () => {
    const { context, request } = makeContext();
    const guard = new OptionalAuthGuard(makeConfig());
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('leaves request.user undefined for an invalid token rather than throwing', () => {
    const { context, request } = makeContext('Bearer garbage');
    const guard = new OptionalAuthGuard(makeConfig());
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('attaches request.user for a valid token, same as AuthGuard', () => {
    const { context, request } = makeContext(bearerFor('u1', 'admin'));
    const guard = new OptionalAuthGuard(makeConfig());
    guard.canActivate(context);
    expect(request.user).toEqual({ id: 'u1', role: 'admin' });
  });
});

describe('AdminGuard — role: admin required', () => {
  it('passes for a valid admin token', () => {
    const { context, request } = makeContext(bearerFor('admin1', 'admin'));
    const guard = new AdminGuard(makeConfig());
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({ id: 'admin1', role: 'admin' });
  });

  it('throws ForbiddenException for a valid but non-admin (role: user) token', () => {
    const { context } = makeContext(bearerFor('u1', 'user'));
    const guard = new AdminGuard(makeConfig());
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException (not Forbidden) when there is no token at all', () => {
    const { context } = makeContext();
    const guard = new AdminGuard(makeConfig());
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
