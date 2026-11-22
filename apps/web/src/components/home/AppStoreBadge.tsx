"use client";

import { iosInstallHref } from "@/lib/appLinks";
import { reportGetAppEvent, type GetAppPlacement } from "@/lib/getAppEvents";

/** Apple's own artwork is 120×40; its marketing guidelines forbid recolouring or redrawing it. */
const BADGE_ASPECT = 120 / 40;

/** The standard "Download on the App Store" badge, via the site's `/ios` redirect so the placement
 * rides along as the App Store campaign token. A client island only so the tap can be reported.
 *
 * `hideOnAndroid`: where both store badges sit side by side (footer), an Android phone only needs Play.
 * Uses html[data-android] (set before first paint in layout.tsx), so it needs no hydration and no shift. */
export function AppStoreBadge({
  placement,
  height,
  hideOnAndroid = false,
  className = "",
}: {
  placement: GetAppPlacement;
  height: number;
  hideOnAndroid?: boolean;
  className?: string;
}) {
  return (
    <a
      href={iosInstallHref("app_store_badge", placement)}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", placement)}
      className={`shrink-0 ${hideOnAndroid ? "[html[data-android='1']_&]:hidden" : ""} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
      <img
        src="/badges/app-store.svg"
        alt="Download on the App Store"
        width={Math.round(height * BADGE_ASPECT)}
        height={height}
        loading="lazy"
        className="block"
      />
    </a>
  );
}

/** The Apple mark, icon-only, for the iPhone/iPad install links (phone header and desktop header), the
 * counterpart of the Google Play icon. Note: Apple's marketing guidelines allow only its App Store badge for
 * promoting an app and say not to use the standalone Apple logo
 * (developer.apple.com/app-store/marketing/guidelines); this is used by choice, so keep it in one place. */
export function AppleStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden className="block">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** Phone header: the Apple mark linking to the App Store. iPhone/iPad browsers only, beside Messages/Login
 * (Android phones get GooglePlayHeaderIcon). Icon only, no text.
 *
 * Always in the server HTML and hidden by default; `html[data-ios="1"]` (set before first paint in layout.tsx)
 * reveals it, so it never shifts the header. */
export function AppStoreHeaderIcon() {
  return (
    <a
      href={iosInstallHref("app_store_icon", "header_mobile")}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", "header_mobile")}
      aria-label="Get the Bhavano app on the App Store"
      title="Get the app on the App Store"
      className="hidden max-sm:[html[data-ios='1']_&]:flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface text-text shrink-0"
    >
      <AppleStoreIcon />
    </a>
  );
}
