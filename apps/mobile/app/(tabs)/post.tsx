import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { resolvePostEntry } from "@bhavano/types/postEntry";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useCitiesQuery } from "../../src/lib/queries";
import { logPostPageView } from "../../src/lib/firebaseAnalytics";
import { PostAdWizard } from "../../src/components/home/PostAdWizard";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import { Trellis } from "../../src/components/Trellis";

export default function PostScreen() {
  const { colors } = useAppTheme();
  const { city, accessToken } = useHomeSheets();
  // `all=true` — not just the popular subset — so the currently-selected city stays a real
  // option in the wizard's dropdown even if it's a tier-2 city.
  const { data: cities, isError, refetch } = useCitiesQuery(undefined, true);

  // Which on-site control sent this visitor here — see
  // docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Unlike web, there's no
  // "typed URL"/bookmark case on mobile — tapping the bottom tab itself (the overwhelmingly
  // common path) carries no `from` param at all, so that's the default rather than "direct".
  const params = useLocalSearchParams<{ from?: string }>();
  const entry = resolvePostEntry(params.from ?? "bottom_tab");
  const pageViewSentRef = useRef(false);
  useEffect(() => {
    if (pageViewSentRef.current) return;
    pageViewSentRef.current = true;
    void logPostPageView({ loggedIn: !!accessToken, entry });
    // Fire once per screen mount, same as web's PostPageTracker — not keyed on accessToken/entry
    // changing later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The tab navigator keeps this screen mounted across tab switches. Without remounting, a
  // category (and the rest of the draft) picked on an earlier visit stays highlighted when the
  // user opens Post Ad again — unlike the website, where navigating to /post always mounts a
  // fresh wizard. Bump on blur so the next visit starts clean; staying on the Post tab (e.g.
  // opening the city picker / option sheets) does not.
  const [visitKey, setVisitKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      return () => setVisitKey((k) => k + 1);
    }, []),
  );

  // This tab stays mounted, so a city list that failed would not be asked for again on its own: try on each return to it. Read through
  // a ref, or a failure while the screen is open would start another try straight away, over and over.
  const failedRef = useRef(false);
  failedRef.current = isError;
  useFocusEffect(
    useCallback(() => {
      if (failedRef.current) void refetch();
    }, [refetch]),
  );

  // No login gate here, matching the website: the whole form is usable logged out (nothing
  // touches the server until Submit — photos are held in memory, not uploaded, until then), and
  // PostAdWizard's own onSubmit is what actually prompts login, only once there's something to
  // post. Gating the screen itself would ask for an account before the visitor has even seen
  // what they're signing up for.
  if (!cities) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Trellis surface="body" />
        <ScreenHeader title="Post an Ad" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
          {isError ? (
            <>
              <Text style={{ color: colors.textSoft, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
                Couldn&apos;t load this page. Check your connection and try again.
              </Text>
              <Pressable
                onPress={() => void refetch()}
                accessibilityRole="button"
                style={{ backgroundColor: colors.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 }}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.green} />
          )}
        </View>
      </View>
    );
  }

  // Keyed on city + visit: city so a Home-tab city switch isn't ignored by a stale
  // `useState(defaultCityId)` init; visit so leaving the Post tab clears the previous draft.
  //
  // PostAdWizard renders its own ScreenHeader (not repeated here) — its back arrow needs to
  // step backward through the wizard's own steps, which only the wizard's internal state knows.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Trellis surface="body" />
      <PostAdWizard
        key={`${city?.id ?? "none"}-${visitKey}`}
        cities={cities}
        defaultCityId={city?.id}
        accessToken={accessToken ?? undefined}
        entry={entry}
      />
    </View>
  );
}
