import { ActivityIndicator, View } from "react-native";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useCitiesQuery } from "../../src/lib/queries";
import { PostAdWizard } from "../../src/components/home/PostAdWizard";

// TEMP(auth-gate): posting is open without login for now.
export default function PostScreen() {
  const { colors } = useAppTheme();
  const { data: cities, isLoading } = useCitiesQuery();

  if (isLoading || !cities) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return <PostAdWizard cities={cities} />;
}
