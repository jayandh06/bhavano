import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../guards/auth.guard';

/** Reads the user attached by AuthGuard/OptionalAuthGuard — undefined for anonymous callers. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});
