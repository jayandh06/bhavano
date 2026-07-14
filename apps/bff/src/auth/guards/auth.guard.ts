import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface RequestUser {
  id: string;
}

function extractUser(request: { headers: Record<string, string | string[] | undefined> }, secret: string): RequestUser | null {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;

  try {
    const payload = jwt.verify(value.slice('Bearer '.length), secret) as { sub: string };
    return { id: payload.sub };
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
