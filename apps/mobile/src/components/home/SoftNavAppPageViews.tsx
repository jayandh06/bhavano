import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { recordAppPageView } from "../../lib/analyticsSession";

/**
 * Records expo-router navigations into the same PageView trail web's SoftNavPageViews writes.
 *
 * Unlike SoftNav (which skips the first path — middleware already logged the document load),
 * this records the cold-open path too: there is no middleware on native, so the first pathname
 * must create both the Visit and the first PageView.
 *
 * Renders nothing; mount once in the root layout inside the navigation tree so `usePathname`
 * is valid.
 */
export function SoftNavAppPageViews() {
  const pathname = usePathname();
  const lastRecorded = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastRecorded.current === pathname) return;
    lastRecorded.current = pathname;
    void recordAppPageView(pathname);
  }, [pathname]);

  return null;
}
