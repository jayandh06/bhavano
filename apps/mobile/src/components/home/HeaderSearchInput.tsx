import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";

const PLACEHOLDER = "2BHK in Koramangala, sofa set…";

/** The header's search field. The hint is drawn as an ordinary <Text> laid over the input while
 * it's empty, not through TextInput's own `placeholder` prop.
 *
 * On iOS (reported on an iPhone 14 Pro Max) the native placeholder rendered with its letters
 * spread out — "2 B H K   i n   K o r a m …" — while every other <Text> in the app was fine, so
 * the problem is in how iOS draws a TextInput's built-in placeholder, not in any style set here.
 * Drawing the hint ourselves takes the native placeholder out of the picture entirely. It looks
 * the same and disappears the moment there's text, exactly as the real one does.
 *
 * `paddingVertical` differs between the two places this appears (the home header and the collapsed
 * scroll bar), so it's a prop rather than baked in. */
export function HeaderSearchInput({
  value,
  onChangeText,
  paddingVertical,
}: {
  value: string;
  onChangeText: (text: string) => void;
  paddingVertical: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoFocus
        accessibilityLabel="Search listings"
        style={[styles.input, { paddingVertical, color: colors.text }]}
      />
      {value.length === 0 && (
        <View pointerEvents="none" style={styles.hintWrap}>
          <Text numberOfLines={1} style={[styles.hint, { color: colors.muted }]}>
            {PLACEHOLDER}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  input: { paddingHorizontal: 8, fontSize: 14, letterSpacing: 0 },
  hintWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", paddingHorizontal: 8 },
  hint: { fontSize: 14, letterSpacing: 0 },
});
