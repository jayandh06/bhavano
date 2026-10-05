"use client";

import { androidIntentUrl } from "@/lib/appLinks";
import { useIsAndroidBrowser } from "@/lib/useAppLinkEnv";
import { reportGetAppEvent } from "@/lib/getAppEvents";

type Placement = "post_success" | "my_listings";

/** Owner-facing "never miss an enquiry" pitch for the Android app: an Open-app button on Android
 * phones, a Play Store QR code on desktop, nothing on other phones (there is no iOS app yet).
 * The QR is CSS-gated (`lg:`) so it server-renders without a layout shift; the Android button
 * needs the user agent, so it only appears after hydration. */
export function GetAppCard({ placement }: { placement: Placement }) {
  const android = useIsAndroidBrowser();

  const heading = <div className="font-bold text-[15px] text-text">Never miss an enquiry</div>;
  const body = (
    <p className="text-[13px] text-text-soft mt-1 mb-0">
      The Bhavano Android app notifies you the moment someone messages about your ad, so you can reply first.
    </p>
  );

  if (android) {
    return (
      <div className="w-full rounded-[10px] border border-border bg-surface-alt/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {heading}
          {body}
        </div>
        <a
          href={androidIntentUrl("my-listings", "get_app_card", placement)}
          onClick={() => reportGetAppEvent("click", placement, "my-listings")}
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
        {heading}
        {body}
        <p className="text-[12px] text-muted mt-1.5 mb-0">Scan with your Android phone to get the app.</p>
      </div>
    </div>
  );
}
