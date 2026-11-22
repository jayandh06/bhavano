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

/** Phone header: Bhavano's own app icon, with a small download arrow, linking to the App Store. iPhone/iPad
 * browsers only, beside Messages/Login (Android phones get GooglePlayHeaderIcon). Icon only, no text.
 *
 * Why Bhavano's icon and not an Apple one: Apple's marketing rules allow only its badge, and forbid using its
 * icons or logo in the badge's place; showing your own app icon that links to the App Store is what its link
 * tools generate. The badge itself needs 40 px of height, which does not fit in this row.
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
      className="hidden max-sm:[html[data-ios='1']_&]:block relative shrink-0 w-8 h-8"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the site's own 38px logo, already cached by the header */}
      <img src="/logo.png" alt="" width={32} height={32} className="block w-8 h-8 rounded-[10px]" />
      <span
        aria-hidden
        className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-green text-on-green border border-surface flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v13M6 12l6 6 6-6" />
        </svg>
      </span>
    </a>
  );
}
