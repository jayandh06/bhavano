import { StyleSheet, Text, View } from "react-native";
import type { ReverseGeocodeResultDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";

/** Web stand-in for the native pin picker. `react-native-maps` is native-only: it calls
 * `codegenNativeComponent`, which react-native-web doesn't export, so *importing* it is enough to
 * crash the web bundle at module-evaluation time — a `Platform.OS` guard inside the component is
 * too late to help. Metro resolves this `.web.tsx` ahead of the sibling `.tsx` when bundling for
 * web, so the import never happens there and the native file stays untouched.
 *
 * Pinning is optional in PostAdWizard ("optional — helps buyers find you"), and the City/Area
 * fields directly below it are what actually get submitted, so this renders a notice and never
 * calls onPinChange — leaving the caller's existing pin state alone rather than clearing it.
 * If web ever needs real pin-picking, implement it here with the Google Maps JS API. */
export function LocationMapPicker(_props: {
  defaultCenter: { lat: number; lng: number };
  onPinChange: (pin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.text, { color: colors.muted }]}>
        Map pin-picking is only available in the Bhavano mobile app. Pick your City and Area below
        instead — they're the fields that get saved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
    padding: 12,
    justifyContent: "center",
  },
  text: { fontSize: 12.5, lineHeight: 18 },
});
