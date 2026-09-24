import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useCitiesQuery } from "../../src/lib/queries";
import { PostAdWizard } from "../../src/components/home/PostAdWizard";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";

export default function PostScreen() {
  const { colors } = useAppTheme();
  const { city, accessToken } = useHomeSheets();
  // `all=true` — not just the popular subset — so the currently-selected city stays a real
  // option in the wizard's dropdown even if it's a tier-2 city.
  const { data: cities, isLoading } = useCitiesQuery(undefined, true);

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

  // No login gate here, matching the website: the whole form is usable logged out (nothing
  // touches the server until Submit — photos are held in memory, not uploaded, until then), and
  // PostAdWizard's own onSubmit is what actually prompts login, only once there's something to
  // post. Gating the screen itself would ask for an account before the visitor has even seen
  // what they're signing up for.
  if (isLoading || !cities) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Post an Ad" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
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
      <PostAdWizard
        key={`${city?.id ?? "none"}-${visitKey}`}
        cities={cities}
        defaultCityId={city?.id}
        accessToken={accessToken ?? undefined}
      />
    </View>
  );
}
