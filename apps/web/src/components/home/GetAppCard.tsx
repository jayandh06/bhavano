"use client";

import { androidIntentUrl } from "@/lib/appLinks";
import { useIsAndroidBrowser } from "@/lib/useAppLinkEnv";
import { reportGetAppEvent, type GetAppPlacement } from "@/lib/getAppEvents";

/** A concrete-reason pitch for the Android app: an Open-app button on Android phones, a Play
 * Store QR code on desktop, nothing on other phones (there is no iOS app yet). The QR is
 * CSS-gated (`lg:`) so it server-renders without a layout shift; the Android button needs the
 * user agent, so it only appears after hydration.
 *
 * `heading`/`body` and `appPath` are explicit per call site (not defaulted) — see
 * docs/plans/drive-users-to-android-app.md step 3: each high-intent moment gets its own reason
 * and sends the Android "Open the app" tap to the matching in-app screen rather than always back
 * to my-listings. */
export function GetAppCard({
  placement,
  appPath,
  heading,
  body,
}: {
  placement: GetAppPlacement;
  appPath: string;
  heading: string;
  body: string;
}) {
  const android = useIsAndroidBrowser();

  const headingEl = <div className="font-bold text-[15px] text-text">{heading}</div>;
  const bodyEl = <p className="text-[13px] text-text-soft mt-1 mb-0">{body}</p>;

  if (android) {
    return (
      <div className="w-full rounded-[10px] border border-border bg-surface-alt/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {headingEl}
          {bodyEl}
        </div>
        <a
          href={androidIntentUrl(appPath, "get_app_card", placement)}
          onClick={() => reportGetAppEvent("click", placement, appPath)}
          className="text-[13px] font-bold text-on-green bg-green rounded-full px-4 py-2 whitespace-nowrap"
        >
          Open the app
        </a>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex w-full items-center gap-4 rounded-[10px] border border-border bg-surface-alt/60 px-4 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
      <img
        src={`/app-qr/${placement}.svg`}
        alt="QR code for the Bhavano app on Google Play"
        width={88}
        height={88}
        className="shrink-0 rounded bg-white"
      />
      <div className="min-w-0">
        {headingEl}
        {bodyEl}
        <p className="text-[12px] text-muted mt-1.5 mb-0">Scan with your Android phone to get the app.</p>
      </div>
    </div>
  );
}
