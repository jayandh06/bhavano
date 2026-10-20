"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_VERSION_PATTERN = void 0;
exports.isValidAppVersion = isValidAppVersion;
exports.compareAppVersions = compareAppVersions;
exports.isBelowMinAppVersion = isBelowMinAppVersion;
/** A dotted version such as "1.2.0": one to three numeric parts, no letters. */
exports.APP_VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,2}$/;
function isValidAppVersion(value) {
    return exports.APP_VERSION_PATTERN.test(value);
}
function parts(version) {
    return version.split(".").map((n) => Number(n));
}
/** Negative when `a` is older than `b`, 0 when equal, positive when newer. "1.2" equals "1.2.0". */
function compareAppVersions(a, b) {
    const pa = parts(a);
    const pb = parts(b);
    for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
/** True only when a valid minimum is set and `current` is below it. Anything unreadable, on either
 * side, answers false: a bad value must never lock people out of the app. */
function isBelowMinAppVersion(current, min) {
    if (!current || !min)
        return false;
    if (!isValidAppVersion(current) || !isValidAppVersion(min))
        return false;
    return compareAppVersions(current, min) < 0;
}
