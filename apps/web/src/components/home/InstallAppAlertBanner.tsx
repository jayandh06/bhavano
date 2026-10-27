import { androidInstallHref } from "@/lib/appLinks";
import { Icon } from "./Icon";

/** Shown wherever an advertiser picks how to be alerted, while they have no app installed: the app is the only way to get an instant, free alert and to
 * reply to a seeker the moment they write. Android only (there is no iOS app yet), so the button goes to the same `/android` route as the site's other
 * "Get the app" buttons. */
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
      <a
        href={androidInstallHref("alert_picker", campaign)}
        className="shrink-0 rounded-lg bg-green px-3.5 py-2 text-[13px] font-bold text-on-green text-center no-underline"
      >
        Get the free app
      </a>
    </div>
  );
}
