import { SetMetadata } from '@nestjs/common';
import type { RateLimitKind } from '@bhavano/types';

export const RATE_LIMIT_KIND = 'rateLimitKind';

/** Marks a route as rate-limited under the given kind — enforced by RateLimitGuard, with the
 * actual limit/window read at request time from the admin-editable RateLimitSetting row. */
export const RateLimitAction = (kind: RateLimitKind) => SetMetadata(RATE_LIMIT_KIND, kind);
