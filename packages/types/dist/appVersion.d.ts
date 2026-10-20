/** Forced app updates: the server publishes the lowest app version it still supports per platform,
 * and the app shows a blocking "update required" screen when its own version is below that. An
 * empty string means "no minimum", which is the default, so nobody is locked out until an admin
 * sets one. See docs/plans/forced-app-update.md. */
export interface AppVersionSettingsDto {
    /** Lowest Android app version still allowed, like "1.2.0". Empty = no minimum. */
    androidMinVersion: string;
    /** Lowest iOS app version still allowed, like "1.2.0". Empty = no minimum. */
    iosMinVersion: string;
    /** Optional line shown on the blocking screen, above the Update button. */
    message: string;
}
/** A dotted version such as "1.2.0": one to three numeric parts, no letters. */
export declare const APP_VERSION_PATTERN: RegExp;
export declare function isValidAppVersion(value: string): boolean;
/** Negative when `a` is older than `b`, 0 when equal, positive when newer. "1.2" equals "1.2.0". */
export declare function compareAppVersions(a: string, b: string): number;
/** True only when a valid minimum is set and `current` is below it. Anything unreadable, on either
 * side, answers false: a bad value must never lock people out of the app. */
export declare function isBelowMinAppVersion(current: string | null | undefined, min: string | null | undefined): boolean;
