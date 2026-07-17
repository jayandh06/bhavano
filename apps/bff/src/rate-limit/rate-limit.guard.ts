import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RateLimitKind } from '@bhavano/types';
import { RATE_LIMIT_KIND } from './rate-limit-kind.decorator';
import { RateLimitService } from './rate-limit.service';

/** Only enforces on authenticated requests — must run after AuthGuard/OptionalAuthGuard so
 * request.user is already populated. Anonymous requests pass through untouched: this app
 * deliberately allows browsing/posting without login, and rate limiting is scoped to
 * "the user" (a real account), not IP/anonymous traffic. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.get<RateLimitKind | undefined>(RATE_LIMIT_KIND, context.getHandler());
    if (!kind) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) return true;

    await this.rateLimitService.checkAndRecordHit(userId, kind);
    return true;
  }
}
