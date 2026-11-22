import { AppStoreBadge } from "./AppStoreBadge";
import { GooglePlayBadge } from "./GooglePlayBadge";

/** Phone-only strip under the header with the one official store badge for the visitor's device:
 * "Get it on Google Play" on an Android browser, "Download on the App Store" on an iPhone/iPad, nothing
 * anywhere else. Apple requires its badge to be unaltered and at least 40 px high on screen, which does
 * not fit in the header's top row beside the logo, so it gets its own row instead of a small icon.
 *
 * In the server HTML and hidden by default; `html[data-android]` / `html[data-ios]` (set before first
 * paint in layout.tsx) reveal it and pick the badge, so nothing shifts after load. */
export function StoreBadgeRow() {
  return (
    <div className="hidden max-sm:[html[data-android='1']_&]:flex max-sm:[html[data-ios='1']_&]:flex items-center justify-center py-1.5 bg-surface border-t border-border">
      <GooglePlayBadge placement="header_mobile" height={40} className="[html[data-ios='1']_&]:hidden" />
      <AppStoreBadge placement="header_mobile" height={40} hideOnAndroid />
    </div>
  );
}
