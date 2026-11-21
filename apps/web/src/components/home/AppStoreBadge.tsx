"use client";

import { iosInstallHref } from "@/lib/appLinks";
import { reportGetAppEvent, type GetAppPlacement } from "@/lib/getAppEvents";
import { Icon } from "./Icon";

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

/** Phone header: an app icon button for iPhone/iPad browsers only, beside Messages/Login. Always in the
 * server HTML and hidden by default; `html[data-ios="1"]` (set before first paint in layout.tsx) reveals it,
 * so it never shifts the header. A generic phone icon rather than Apple's logo, which is reserved for the badge. */
export function AppStoreHeaderIcon() {
  return (
    <a
      href={iosInstallHref("app_store_icon", "header_mobile")}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", "header_mobile")}
      aria-label="Get the Bhavano app on the App Store"
      title="Get the app on the App Store"
      className="hidden max-sm:[html[data-ios='1']_&]:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface text-text"
    >
      <Icon name="smartphone" />
    </a>
  );
}
