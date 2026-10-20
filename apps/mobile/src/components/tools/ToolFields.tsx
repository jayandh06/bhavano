import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";

/** Labelled numeric input shared by every calculator. The value stays a string in the caller's
 * state (not parsed here) so an empty or half-typed field doesn't force a premature 0 — same as
 * the website's NumberField. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[styles.label, { color: colors.muted }]}>
        {label}
        {suffix ? ` (${suffix})` : ""}
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ""))}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />
    </View>
  );
}

/** The result panel under the fields: a label, a large value, and an optional detail line. */
export function ResultCard({ label, value, detail }: { label?: string; value?: string | false; detail?: string }) {
  const { colors } = useAppTheme();
  if (!value) return null;
  return (
    <View style={[styles.result, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      {label && (
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 4 }}>{label.toUpperCase()}</Text>
      )}
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.green }}>{value}</Text>
      {detail && <Text style={{ fontSize: 13, color: colors.textSoft, marginTop: 6, lineHeight: 19 }}>{detail}</Text>}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <Text style={{ fontSize: 12.5, color: colors.muted, lineHeight: 18 }}>{children}</Text>;
}

/** A row of mutually exclusive choices (a mode switch, or a unit picker). */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const on = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                styles.chip,
                { borderColor: on ? colors.green : colors.border, backgroundColor: on ? colors.surfaceAlt : colors.surface },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: on ? colors.green : colors.text }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15 },
  result: { borderWidth: 1, borderRadius: 12, padding: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
});
