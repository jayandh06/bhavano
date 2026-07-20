import { ActivityIndicator, View } from "react-native";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useCitiesQuery } from "../../src/lib/queries";
import { PostAdWizard } from "../../src/components/home/PostAdWizard";

// TEMP(auth-gate): posting is open without login for now.
export default function PostScreen() {
  const { colors } = useAppTheme();
  const { city } = useHomeSheets();
  // `all=true` — not just the popular subset — so the currently-selected city stays a real
  // option in the wizard's dropdown even if it's a tier-2 city.
  const { data: cities, isLoading } = useCitiesQuery(undefined, true);

  if (isLoading || !cities) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return <PostAdWizard cities={cities} defaultCityId={city?.id} />;
}
