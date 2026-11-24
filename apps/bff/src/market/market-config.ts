import { getMarket } from '@bhavano/types/market';

/**
 * The market this BFF deployment serves, from the MARKET environment variable (`in` or `us`). Unset, empty or
 * unknown means India, so every existing deployment behaves exactly as before. Read once at import time because
 * the `@Cron` decorators need the time zone when the module loads.
 * See docs/plans/us-market-expansion.md.
 */
export const MARKET = getMarket(process.env.MARKET);

/** IANA time zone of this deployment's market (`Asia/Kolkata` for India). */
export const MARKET_TIME_ZONE = MARKET.timeZone;
