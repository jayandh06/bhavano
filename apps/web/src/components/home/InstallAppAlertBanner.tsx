import { androidInstallHref, iosInstallHref } from "@/lib/appLinks";
import { Icon } from "./Icon";

/** Shown wherever an advertiser picks how to be alerted, while they have no app installed: the app is the only way to get an instant, free alert and to
 * reply to a seeker the moment they write. The button goes to the `/android` route (Play) like the site's other
 * "Get the app" buttons, or `/ios` (App Store) on iPhone/iPad. */
export function InstallAppAlertBanner({ campaign }: { campaign: string }) {
  return (
    <div className="rounded-xl border border-green/40 bg-green/10 p-3.5 mb-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="text-green text-xl shrink-0">
        <Icon name="smartphone" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[14px] font-bold text-text">Install the free Bhavano app to get instant alerts and reply to seekers right away</p>
        <p className="m-0 mt-0.5 text-[12px] text-text-soft">
          Seekers move on quickly. With the app you are notified the moment someone writes, views your number or shows interest, and you can answer in one tap.
        </p>
      </div>
      {/* The official store badges, not a text button. One is shown per device (set before first paint, so no
        * shift): the App Store badge on iPhone/iPad, Google Play on Android, both on a desktop browser where
        * either phone could scan or follow it. The links keep the `/android` and `/ios` redirects and the same
        * medium/campaign as before, so install attribution is unchanged. */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={androidInstallHref("alert_picker", campaign)}
          className="shrink-0 [html[data-ios='1']_&]:hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
          <img src="/badges/google-play.svg" alt="Get it on Google Play" width={Math.round(40 * (180 / 53.333))} height={40} className="block" />
        </a>
        <a
          href={iosInstallHref("alert_picker", campaign)}
          className="shrink-0 [html[data-android='1']_&]:hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise */}
          <img src="/badges/app-store.svg" alt="Download on the App Store" width={120} height={40} className="block" />
        </a>
      </div>
    </div>
  );
}
