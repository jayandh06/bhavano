/** Admin-editable Instant Alerts price — same singleton-row convention as BoostPriceSettings.
 * Flat, no category tiers: unlike boost (which trades on listing visibility, so a cheap category
 * getting the same fee as an expensive one is unfair), the value here — being told about a
 * message the instant it arrives — doesn't scale with the listing's own price. See
 * docs/plans/instant-alerts-paid-message-notifications.md. */
export interface InstantAlertsPriceSettings {
    instantAlertsPrice: number;
}
/** Bundled into this shared package (not just the BFF) for the same reason
 * DEFAULT_BOOST_PRICE_SETTINGS is — used client-side for display before any live-settings fetch
 * resolves, and as the BFF's own DB-row fallback when no settings have ever been saved. */
export declare const DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS: InstantAlertsPriceSettings;
