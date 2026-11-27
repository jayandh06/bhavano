import type { ListingCategory } from '@bhavano/types';
import { platformFeeApplies, type PlatformFeeSettings } from '@bhavano/types/platformFeePricing';
import { MARKET } from '../market/market-config';

/**
 * Whether a new ad must wait in `pending_checkout` until something is paid: a listing fee for its category, or the boost the seller chose.
 * Never where nothing can be bought, whatever the settings say, or the ad would wait for a payment that cannot be made. The admin's
 * "publish with payment pending" switch lets it go live anyway.
 */
export function holdsForPayment(category: ListingCategory, settings: PlatformFeeSettings, wantsBoost: boolean): boolean {
  if (!MARKET.paymentsEnabled || settings.allowLivePublishWithPendingPayment) return false;
  return platformFeeApplies(category, settings) || wantsBoost;
}
