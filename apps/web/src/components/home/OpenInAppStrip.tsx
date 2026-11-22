"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { androidIntentUrl, appPathForWebPath, appStoreUrl, iosAppUrl, recordAdVisit } from "@/lib/appLinks";
import { useCameFromAdRecently, useDismissedToday, useIsAndroidBrowser, useIsIosBrowser } from "@/lib/useAppLinkEnv";
import { reportGetAppEvent } from "@/lib/getAppEvents";
import { Icon } from "./Icon";

/** "Open in the Bhavano app" bar on Android and iPhone/iPad mobile web — opens the same page in the app, or the
 * store without it (see docs/plans/drive-users-to-android-app.md). Android uses an intent:// link that does both in
 * one tap. iPhone has no such link, so the button tries the `bhavano://` scheme and falls back to the App Store
 * itself (`openInIosApp` below).
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

/** How long to wait for the app to take over before going to the App Store. */
const IOS_FALLBACK_MS = 2500;

/** Tries to open the page in the app; goes to the App Store if the app did not take over.
 *
 * Opening the app hides the page (visibilitychange / pagehide) or takes focus away, and iOS puts up its own
 * "Open in Bhavano?" confirmation first, which also takes focus. So the App Store is only used when the page is
 * still visible AND still focused after the wait, i.e. nothing happened. Without the app installed Safari
 * shows its own "cannot open the page" alert, and the fallback then lands on the App Store. */
function openInIosApp(appPath: string): void {
  let handled = false;
  const mark = () => {
    handled = true;
  };
  document.addEventListener("visibilitychange", mark, { once: true });
  window.addEventListener("pagehide", mark, { once: true });
  window.addEventListener("blur", mark, { once: true });
  window.location.href = iosAppUrl(appPath);
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", mark);
    window.removeEventListener("pagehide", mark);
    window.removeEventListener("blur", mark);
    if (!handled && document.visibilityState === "visible" && document.hasFocus()) {
      window.location.href = appStoreUrl("open_in_app_strip", appPath ? appPath.split("/")[0] : "home");
    }
  }, IOS_FALLBACK_MS);
}

export function OpenInAppStrip() {
  const pathname = usePathname();
  const android = useIsAndroidBrowser();
  const ios = useIsIosBrowser();
  const fromAd = useCameFromAdRecently();
  const { dismissed, dismiss } = useDismissedToday(DISMISS_KEY);

  // On every navigation, not just mount, so an ad landing page records the visit even when the
  // strip is hidden on it anyway (e.g. an ad that lands on /post).
  useEffect(() => {
    recordAdVisit(window.location.search);
  }, [pathname]);

  const visible =
    (android || ios) &&
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
      {ios ? (
        <button
          type="button"
          onClick={() => {
            reportGetAppEvent("click", "strip", appPath);
            openInIosApp(appPath);
          }}
          className="shrink-0 text-[13px] font-bold text-on-green bg-green rounded-full px-4 py-2 border-0 cursor-pointer"
        >
          Open app
        </button>
      ) : (
        <a
          href={androidIntentUrl(appPath, "open_in_app_strip", appPath ? appPath.split("/")[0] : "home")}
          onClick={() => reportGetAppEvent("click", "strip", appPath)}
          className="shrink-0 text-[13px] font-bold text-on-green bg-green rounded-full px-4 py-2"
        >
          Open app
        </a>
      )}
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
