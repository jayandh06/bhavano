/** How an advertiser wants to be told when a seeker contacts them — see docs/plans/owner-notification-channel-preferences.md. */
export declare const OWNER_ALERT_CHANNELS: readonly ["push", "whatsapp", "sms", "email"];
export type OwnerAlertChannel = (typeof OWNER_ALERT_CHANNELS)[number];
/** Order used until the owner says otherwise, and to fill in the channels they did not rank. The app is first because it is the fastest and free;
 * WhatsApp next because it is the only out-of-app channel that reaches the phone-only majority of owners. */
export declare const DEFAULT_OWNER_ALERT_ORDER: readonly OwnerAlertChannel[];
export declare const OWNER_ALERT_CHANNEL_LABELS: Record<OwnerAlertChannel, string>;
/** What happened that the owner is being told about. */
export type OwnerAlertKind = "message" | "interest" | "reveal";
export interface OwnerAlertPreferenceDto {
    /** Ranked, first = tried first. Always a permutation of all four channels. */
    channels: OwnerAlertChannel[];
    /** False until the owner has chosen themselves (the default order is in force). Drives the one-time question after posting. */
    confirmed: boolean;
    /** Which channels can reach this account right now (an app install, a phone, an email address). Unavailable ones are shown but cannot be the top pick. */
    available: Record<OwnerAlertChannel, boolean>;
}
/** Puts `primary` first and keeps everyone else in the order they already had, so choosing a primary never scrambles the fallbacks. */
export declare function withPrimaryChannel(current: readonly OwnerAlertChannel[], primary: OwnerAlertChannel): OwnerAlertChannel[];
/** Drops unknown and repeated entries, then appends the channels that were left out, so a stored order is always complete. */
export declare function normalizeOwnerAlertOrder(input: readonly string[] | null | undefined): OwnerAlertChannel[];
/** WhatsApp and SMS cost money per message, so they are part of Featured ads (Instant Alerts is included in every boost). Push and email are free for everyone. */
export declare const PAID_OWNER_ALERT_CHANNELS: readonly OwnerAlertChannel[];
export declare function isPaidOwnerAlertChannel(channel: OwnerAlertChannel): boolean;
/** The channel an alert about one ad actually goes out on: the first of the owner's order that can reach them and that this ad is allowed to use
 * (a paid channel only while the ad is Featured). Null when none can, which the Preview step treats as "choose or add one before posting". */
export declare function effectiveOwnerAlertChannel(order: readonly OwnerAlertChannel[], available: Record<OwnerAlertChannel, boolean>, featured: boolean): OwnerAlertChannel | null;
