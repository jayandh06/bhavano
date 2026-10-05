"use client";

import { playStoreUrl } from "@/lib/appLinks";
import { reportGetAppEvent } from "@/lib/getAppEvents";

/** The footer's Google Play link — a client island only so the tap can be reported; the footer
 * itself stays a server component. */
export function FooterPlayStoreLink() {
  return (
    <a
      href={playStoreUrl("footer_link", "footer")}
      target="_blank"
      rel="noopener"
      onClick={() => reportGetAppEvent("click", "footer")}
      className="text-[13px] text-green font-bold"
    >
      Android app on Google Play →
    </a>
  );
}
