import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { City } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useCitiesQuery } from "../../lib/queries";

export type PickedCity = Pick<City, "id" | "name">;

/**
 * Mobile counterpart to web's `RequirementCityPicker` — "Which city?" for a requirement, on the
 * capture card when the home screen has no city, and in the refinement questions for a row saved
 * before a city was required. Popular cities as chips (the same list the city sheet opens with),
 * and a search for the rest.
 */
export function RequirementCityPicker({
  value,
  onChange,
  disabled,
  onFocus,
}: {
  value?: PickedCity;
  onChange: (city: PickedCity) => void;
  disabled?: boolean;
  onFocus?: () => void;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const { data: cities, isLoading } = useCitiesQuery(debounced || undefined);

  const shown = [...(value && !cities?.some((c) => c.id === value.id) ? [value] : []), ...(cities ?? [])];

  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onFocus={onFocus}
        editable={!disabled}
        placeholder="Search for your city"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />
      {isLoading ? (
        <ActivityIndicator color={colors.green} />
      ) : shown.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12.5 }}>No city by that name.</Text>
      ) : (
        <View style={styles.wrapRow}>
          {shown.map((city) => {
            const active = value?.id === city.id;
            return (
              <Pressable
                key={city.id}
                onPress={() => onChange({ id: city.id, name: city.name })}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.surfaceAlt : colors.surface,
                    borderColor: active ? colors.green : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, color: active ? colors.green : colors.text, fontWeight: active ? "700" : "400" }}>
                  {city.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14 },
});
