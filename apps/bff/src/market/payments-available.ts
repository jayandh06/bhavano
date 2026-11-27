import { ForbiddenException } from '@nestjs/common';
import { MARKET } from './market-config';

/** Refuses anything that would take money where nothing is sold yet (the US). Free grants do not pass through here. */
export function assertPaymentsEnabled(): void {
  if (!MARKET.paymentsEnabled) {
    throw new ForbiddenException({ code: 'PAYMENTS_UNAVAILABLE', message: 'Payments are not available yet.' });
  }
}
