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
