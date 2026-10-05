"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { androidIntentUrl, appPathForWebPath, recordAdVisit } from "@/lib/appLinks";
import { useCameFromAdRecently, useDismissedToday, useIsAndroidBrowser } from "@/lib/useAppLinkEnv";
import { reportGetAppEvent } from "@/lib/getAppEvents";
import { Icon } from "./Icon";

/** "Open in the Bhavano app" bar on Android mobile web — opens the same page in the app, or the
 * Play Store without it (see docs/plans/drive-users-to-android-app.md).
 *
 * Fixed to the bottom, not an in-flow bar: it can only be decided after hydration (user agent,
 * localStorage), and an in-flow bar appearing then would shift the page. While it shows, it sets
 * `--app-strip-h` on <html>, which pads <body> and lifts the other bottom-pinned cards
 * (ProfileCompletionBanner, ListingLoginNudge) above it instead of under it. */

/** ✕ hides it until the visitor's next calendar day. */
const DISMISS_KEY = "bhavano_open_in_app_dismissed";
const STRIP_HEIGHT = "56px";

/** Mid-task pages where pulling someone into the app would cost the task itself (the post-ad
 * wizard is also the website's Ads conversion), plus sign-in and payment hand-offs. */
const HIDDEN_PREFIXES = ["/post", "/checkout", "/auth", "/claim"];

export function OpenInAppStrip() {
  const pathname = usePathname();
  const android = useIsAndroidBrowser();
  const fromAd = useCameFromAdRecently();
  const { dismissed, dismiss } = useDismissedToday(DISMISS_KEY);

  // On every navigation, not just mount, so an ad landing page records the visit even when the
  // strip is hidden on it anyway (e.g. an ad that lands on /post).
  useEffect(() => {
    recordAdVisit(window.location.search);
  }, [pathname]);

  const visible =
    android &&
    !fromAd &&
    !dismissed &&
    !HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty("--app-strip-h", STRIP_HEIGHT);
    return () => {
      document.documentElement.style.removeProperty("--app-strip-h");
    };
  }, [visible]);

  if (!visible) return null;

  const appPath = appPathForWebPath(pathname);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center gap-3 pl-4 pr-2 pb-[env(safe-area-inset-bottom)]"
      style={{ minHeight: STRIP_HEIGHT }}
    >
      <span className="shrink-0 w-8 h-8 rounded-lg bg-green text-on-green font-lora font-bold text-lg flex items-center justify-center">
        B
      </span>
      <span className="flex-1 min-w-0 text-[13px] leading-tight text-text-soft">
        <span className="block font-bold text-text">Bhavano app</span>
        Faster, with instant enquiry alerts
      </span>
      <a
        href={androidIntentUrl(appPath, "open_in_app_strip", appPath ? appPath.split("/")[0] : "home")}
        onClick={() => reportGetAppEvent("click", "strip", appPath)}
        className="shrink-0 text-[13px] font-bold text-on-green bg-green rounded-full px-4 py-2"
      >
        Open app
      </a>
      <button
        onClick={() => {
          reportGetAppEvent("dismiss", "strip");
          dismiss();
        }}
        aria-label="Dismiss"
        className="shrink-0 w-8 h-8 flex items-center justify-center bg-transparent border-0 text-muted cursor-pointer"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
