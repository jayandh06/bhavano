"use client";

import { androidIntentUrl } from "@/lib/appLinks";
import { useIsAndroidBrowser, useIsIosBrowser } from "@/lib/useAppLinkEnv";
import type { GetAppPlacement } from "@/lib/getAppEvents";
import { AppStoreBadge } from "./AppStoreBadge";
import { GooglePlayBadge } from "./GooglePlayBadge";

/** A concrete-reason pitch for the Bhavano app (Android and iPhone): a Play Store QR code on desktop (`lg:`), the
 * "Get it on Google Play" badge on phones and tablets. The QR/badge split is CSS-gated so it
 * server-renders without a layout shift. On Android the badge is an intent link — it opens the app
 * at `appPath` when installed, the Play Store otherwise — and shows at every width, since an
 * Android tablet in landscape can be `lg:` wide but can't scan its own screen.
 *
 * `heading`/`body` and `appPath` are explicit per call site (not defaulted) — see
 * docs/plans/drive-users-to-android-app.md step 3: each high-intent moment gets its own reason
 * and sends the Android tap to the matching in-app screen rather than always back to
 * my-listings. */
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
  // iPhones and iPads get the App Store badge at every width (an iPad can be `lg:` wide but can't scan its own
  // screen, same as the Android tablet case); the desktop QR below stays Play-only.
  const ios = useIsIosBrowser();

  const headingEl = <div className="font-bold text-[15px] text-text">{heading}</div>;
  const bodyEl = <p className="text-[13px] text-text-soft mt-1 mb-0">{body}</p>;

  const badgeCard = (className: string) => (
    <div
      className={`w-full rounded-[10px] border border-border bg-surface-alt/60 px-4 py-3 flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="min-w-0 flex-1">
        {headingEl}
        {bodyEl}
      </div>
      {ios ? (
        <AppStoreBadge placement={placement} height={40} />
      ) : (
        <GooglePlayBadge
          placement={placement}
          height={40}
          href={android ? androidIntentUrl(appPath, "get_app_card", placement) : undefined}
          appPath={android ? appPath : undefined}
        />
      )}
    </div>
  );

  if (android || ios) return badgeCard("flex");

  return (
    <>
      {badgeCard("flex lg:hidden")}
      <div className="hidden lg:flex w-full items-center gap-4 rounded-[10px] border border-border bg-surface-alt/60 px-4 py-3">
        <div className="flex shrink-0 gap-3">
          {[
            { src: `/app-qr/${placement}.svg`, alt: "QR code for the Bhavano app on Google Play", label: "Android" },
            { src: `/app-qr/ios-${placement}.svg`, alt: "QR code for the Bhavano app on the App Store", label: "iPhone" },
          ].map((qr) => (
            <figure key={qr.label} className="m-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
              <img src={qr.src} alt={qr.alt} width={88} height={88} className="rounded bg-white" />
              <figcaption className="text-[11px] text-muted mt-1">{qr.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="min-w-0">
          {headingEl}
          {bodyEl}
          <p className="text-[12px] text-muted mt-1.5 mb-0">Scan with your phone&apos;s camera to get the app.</p>
        </div>
      </div>
    </>
  );
}
