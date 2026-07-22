import { ActivityIndicator, View } from "react-native";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useCitiesQuery } from "../../src/lib/queries";
import { PostAdWizard } from "../../src/components/home/PostAdWizard";
import { GatedScreen } from "../../src/components/home/GatedScreen";

export default function PostScreen() {
  const { colors } = useAppTheme();
  const { city, isLoggedIn, accessToken } = useHomeSheets();
  // `all=true` — not just the popular subset — so the currently-selected city stays a real
  // option in the wizard's dropdown even if it's a tier-2 city.
  const { data: cities, isLoading } = useCitiesQuery(undefined, true);

  if (!isLoggedIn || !accessToken) {
    return <GatedScreen title="Post a free ad" />;
  }

  if (isLoading || !cities) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  // Keyed on the selected city: the tab navigator keeps this screen mounted across tab
  // switches, so without a key change, React would reuse the wizard instance and its stale
  // `useState(defaultCityId)` init instead of picking up a city switch made on the Home tab.
  return <PostAdWizard key={city?.id ?? "none"} cities={cities} defaultCityId={city?.id} accessToken={accessToken} />;
}
