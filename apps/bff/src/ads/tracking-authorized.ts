/** `x-tracking-authorized` is set by the mobile app from its iOS App Tracking Transparency
 * prompt result — `"false"` is the only value that means anything (an explicit ATT denial); web
 * has no such concept and never sends this header, and anything else (absent, `"true"`, a
 * malformed value) is treated as authorized, matching pre-ATT unrestricted behavior. Shared by
 * every controller whose endpoint can trigger a GoogleAdsConversionProvider upload. */
export function parseTrackingAuthorized(header: string | undefined): boolean | undefined {
  return header === 'false' ? false : undefined;
}
