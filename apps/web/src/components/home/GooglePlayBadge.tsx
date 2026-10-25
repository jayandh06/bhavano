"use client";

import { androidInstallHref } from "@/lib/appLinks";
import { reportGetAppEvent, type GetAppPlacement } from "@/lib/getAppEvents";
import { Icon } from "./Icon";

/** Google's own artwork is 180×53.33; its brand rules forbid recolouring or redrawing it. */
const BADGE_ASPECT = 180 / 53.333;

/** The standard "Get it on Google Play" badge, linking to the Play listing with this placement's
 * install referrer, or to `href` when given (GetAppCard's open-or-install intent link). A client
 * island only so the tap can be reported. */
export function GooglePlayBadge({
  placement,
  height,
  href,
  appPath,
  className = "",
}: {
  placement: GetAppPlacement;
  height: number;
  href?: string;
  appPath?: string;
  className?: string;
}) {
  const external = !href;
  return (
    <a
      href={href ?? androidInstallHref("play_badge", placement)}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      onClick={() => reportGetAppEvent("click", placement, appPath)}
      className={`shrink-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
      <img
        src="/badges/google-play.svg"
        alt="Get it on Google Play"
        width={Math.round(height * BADGE_ASPECT)}
        height={height}
        // Footer and cards sit below the first screen, and width/height are set, so there is no layout shift.
        loading="lazy"
        className="block"
      />
    </a>
  );
}

/** Desktop header: "Get the app", with the Play QR in a popover on hover or keyboard focus — a
 * phone camera is the easy way from a desktop. Clicking opens the Play web listing, which can
 * install to a signed-in phone. CSS-gated (`lg:`), so it server-renders with no layout shift. */
export function GetAppHeaderQr() {
  return (
    <div className="group relative hidden lg:block shrink-0">
      <a
        href={androidInstallHref("header_link", "header")}
        target="_blank"
        rel="noopener"
        onClick={() => reportGetAppEvent("click", "header")}
        className="inline-flex items-center gap-1.5 text-text text-sm font-bold whitespace-nowrap"
      >
        <Icon name="smartphone" /> Get the app
      </a>
      <div className="absolute right-0 top-full pt-2 z-50 hidden group-hover:block group-focus-within:block">
        <div className="w-[200px] rounded-[10px] border border-border bg-surface p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
          <img
            src="/app-qr/header.svg"
            alt="QR code for the Bhavano app on Google Play"
            width={140}
            height={140}
            loading="lazy"
            className="mx-auto rounded bg-white"
          />
          <p className="text-[12px] text-text-soft mt-2 mb-0">Scan with your Android phone to get the Bhavano app.</p>
        </div>
      </div>
    </div>
  );
}

/** Phone header: just the Play logo, for Android browsers only (there is no iOS app). A play.google.com
 * link opens the Play Store app on Android.
 *
 * Always in the server HTML and hidden by default; `html[data-android="1"]` (set by a tiny script in
 * layout.tsx before first paint) reveals it on Android phones. It used to render only after hydration,
 * which made it pop in and shift the whole header row (a layout-shift source on mobile). */
export function GooglePlayHeaderIcon() {
  return (
    <a
      href={androidInstallHref("play_icon", "header_mobile")}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", "header_mobile")}
      aria-label="Get the Bhavano app on Google Play"
      title="Get the app on Google Play"
      className="hidden max-sm:[html[data-android='1']_&]:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
      <img src="/badges/google-play-icon.svg" alt="" width={16} height={17} className="block" />
    </a>
  );
}
