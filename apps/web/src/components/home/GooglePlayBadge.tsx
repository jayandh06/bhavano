"use client";

import { playStoreUrl } from "@/lib/appLinks";
import { reportGetAppEvent, type GetAppPlacement } from "@/lib/getAppEvents";
import { useIsAndroidBrowser } from "@/lib/useAppLinkEnv";

/** Google's own artwork is 180×53.33; its brand rules forbid recolouring or redrawing it. */
const BADGE_ASPECT = 180 / 53.333;

/** The standard "Get it on Google Play" badge, linking to the Play listing with this placement's
 * install referrer. A client island only so the tap can be reported. */
export function GooglePlayBadge({
  placement,
  height,
  className = "",
}: {
  placement: Extract<GetAppPlacement, "footer" | "header">;
  height: number;
  className?: string;
}) {
  return (
    <a
      href={playStoreUrl("play_badge", placement)}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", placement)}
      className={`shrink-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
      <img
        src="/badges/google-play.svg"
        alt="Get it on Google Play"
        width={Math.round(height * BADGE_ASPECT)}
        height={height}
        className="block"
      />
    </a>
  );
}

/** Phone header: just the Play logo, for Android browsers only (there is no iOS app). Needs the
 * user agent, so it appears right after hydration. A play.google.com link opens the Play Store
 * app on Android. */
export function GooglePlayHeaderIcon() {
  const android = useIsAndroidBrowser();
  if (!android) return null;
  return (
    <a
      href={playStoreUrl("play_icon", "header_mobile")}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", "header_mobile")}
      aria-label="Get the Bhavano app on Google Play"
      title="Get the app on Google Play"
      className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
      <img src="/badges/google-play-icon.svg" alt="" width={16} height={17} className="block" />
    </a>
  );
}
