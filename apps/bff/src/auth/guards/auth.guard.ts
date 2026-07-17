import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { UserRole } from '@bhavano/types';

export interface RequestUser {
  id: string;
  role: UserRole;
}

function extractUser(request: { headers: Record<string, string | string[] | undefined> }, secret: string): RequestUser | null {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;

  try {
    const payload = jwt.verify(value.slice('Bearer '.length), secret) as { sub: string; role?: UserRole };
    return { id: payload.sub, role: payload.role ?? 'user' };
  } catch {
    return null;
  }
}

/** Requires a valid Bearer JWT (issued by AuthService.issueSession) — throws otherwise. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = this.config.get<string>('AUTH_JWT_SECRET') ?? 'dev-only-change-me';
    const user = extractUser(request, secret);
    if (!user) throw new UnauthorizedException('Login required');
    request.user = user;
    return true;
  }
}

/** Same validation, but never blocks the request — leaves req.user undefined for
 * anonymous callers so routes can serve both logged-in and anonymous viewers. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = this.config.get<string>('AUTH_JWT_SECRET') ?? 'dev-only-change-me';
    request.user = extractUser(request, secret) ?? undefined;
    return true;
  }
}

/** Requires a valid Bearer JWT AND role: 'admin' — the role claim is trusted from the JWT
 * (set at login, see AuthService.issueSession) rather than re-checked against the DB on
 * every request, consistent with the token's existing 1h TTL. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = this.config.get<string>('AUTH_JWT_SECRET') ?? 'dev-only-change-me';
    const user = extractUser(request, secret);
    if (!user) throw new UnauthorizedException('Login required');
    if (user.role !== 'admin') throw new ForbiddenException('Admin access required');
    request.user = user;
    return true;
  }
}
