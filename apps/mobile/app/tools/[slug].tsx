import { View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import { CALCULATORS } from "../../src/components/tools/Calculators";
import { TOOLS } from "../../src/components/tools/toolsRegistry";

// One screen for all six calculators, keyed by the website path's last segment, so
// bhavano.com/tools/emi-calculator opens the matching screen via App Links.
export default function ToolScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const tool = TOOLS.find((t) => t.slug === slug);
  const Calculator = slug ? CALCULATORS[slug] : undefined;

  if (!tool || !Calculator) return <Redirect href="/tools" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={tool.title} onBack={() => (router.canGoBack() ? router.back() : router.replace("/tools"))} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 18 }}
      >
        <Calculator />
      </KeyboardAwareScrollView>
    </View>
  );
}
