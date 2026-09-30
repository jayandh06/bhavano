import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { shouldShowAppLoginPrompt } from "@bhavano/types/loginNudge";
import { useHomeSheets } from "../context/HomeSheetsProvider";
import { useLoginNudgeSettingsQuery } from "./queries";

/** Listing screens opened while logged out since the last skip. */
const DETAIL_VIEWS_KEY = "bhavano.nudge.detailViews";
const DISMISSED_AT_KEY = "bhavano.nudge.dismissedAt";
/** Long enough to see which listing they opened before being asked. */
const SHOW_DELAY_MS = 1200;

/**
 * The listing-detail login ask: opens the login sheet with a Skip button on the Nth listing a
 * logged-out visitor opens, then stays quiet for the admin-set cooldown after a skip. Admin
 * settings: docs/plans/listing-detail-login-nudge.md. Logging in from it records interest through
 * the listing screen's existing accessToken effect.
 */
export function useListingLoginNudge(listing: { isOwner: boolean } | undefined): void {
  const { requireLogin, accessToken, sessionReady } = useHomeSheets();
  const eligible = sessionReady && !accessToken;
  const { data: settings } = useLoginNudgeSettingsQuery(eligible);
  const counted = useRef(false);
  const [due, setDue] = useState(false);
  const loaded = !!listing;
  const isOwner = listing?.isOwner ?? false;

  // Once per screen: this open counts towards the total whether or not it asks.
  useEffect(() => {
    if (counted.current || !eligible || !settings || !loaded || isOwner) return;
    counted.current = true;
    void (async () => {
      const [storedViews, storedDismissedAt] = await Promise.all([
        AsyncStorage.getItem(DETAIL_VIEWS_KEY).catch(() => null),
        AsyncStorage.getItem(DISMISSED_AT_KEY).catch(() => null),
      ]);
      const detailViews = Number(storedViews ?? "0") + 1;
      await AsyncStorage.setItem(DETAIL_VIEWS_KEY, String(detailViews)).catch(() => undefined);
      setDue(
        shouldShowAppLoginPrompt({
          enabled: settings.appPromptEnabled,
          afterDetailViews: settings.appPromptAfterDetailViews,
          cooldownDays: settings.dismissCooldownDays,
          detailViews,
          dismissedAtMs: Number(storedDismissedAt ?? "") || null,
          nowMs: Date.now(),
        }),
      );
    })();
  }, [eligible, settings, loaded, isOwner]);

  useEffect(() => {
    if (!due || !eligible || !settings) return;
    const timer = setTimeout(() => {
      setDue(false);
      requireLogin({
        skippable: {
          reason:
            settings.freeRevealsPerUser > 0
              ? `See ${settings.freeRevealsPerUser} owner phone numbers free, save listings and get alerts for new ones.`
              : "Save listings, message owners and get alerts for new ones.",
          onSkip: () => {
            void AsyncStorage.multiSet([
              [DISMISSED_AT_KEY, String(Date.now())],
              [DETAIL_VIEWS_KEY, "0"],
            ]).catch(() => undefined);
          },
        },
      });
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [due, eligible, settings, requireLogin]);
}
