import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { City } from "@bhavano/types";
import { fetchCities, updateProfile } from "../../lib/bffClient";
import { useAppTheme } from "../../theme/ThemeContext";

const MIN_CITY_QUERY = 2;

export interface ProfileBasicsValues {
  name: string;
  cityId: string | null;
  cityName: string | null;
}

/**
 * Post-login name + optional preferred city — see docs/plans/post-login-name-and-city.md.
 * Mirrors web's ProfileBasicsStep: name required; city type-ahead after ≥2 characters.
 */
export function ProfileBasicsStep({
  accessToken,
  initial,
  onSaved,
  onSkip,
}: {
  accessToken: string;
  initial: ProfileBasicsValues;
  onSaved: (saved: ProfileBasicsValues & { city: City | null }) => void;
  onSkip: () => void;
}) {
  const { colors } = useAppTheme();
  const [name, setName] = useState(initial.name);
  const [cityId, setCityId] = useState<string | null>(initial.cityId);
  const [cityName, setCityName] = useState<string | null>(initial.cityName);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [cityNoResults, setCityNoResults] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length > 0;
  const canSkip = initial.name.trim().length > 0;

  useEffect(() => {
    setName(initial.name);
    setCityId(initial.cityId);
    setCityName(initial.cityName);
  }, [initial.name, initial.cityId, initial.cityName]);

  async function onCityQueryChange(value: string) {
    setCityQuery(value);
    setCityNoResults(false);
    if (value.trim().length < MIN_CITY_QUERY) {
      setCityResults([]);
      return;
    }
    const results = await fetchCities(value.trim()).catch(() => []);
    setCityResults(results);
    setCityNoResults(results.length === 0);
  }

  function selectCity(city: City) {
    setCityId(city.id);
    setCityName(city.name);
    setSelectedCity(city);
    setCityQuery("");
    setCityResults([]);
    setCityNoResults(false);
  }

  function clearCity() {
    setCityId(null);
    setCityName(null);
    setSelectedCity(null);
    setCityQuery("");
    setCityResults([]);
  }

  async function onContinue() {
    if (!nameOk) {
      setError("Please enter your name");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const profile = await updateProfile(accessToken, {
        name: name.trim(),
        ...(cityId ? { cityId } : {}),
      });
      onSaved({
        name: name.trim(),
        cityId: profile.cityId,
        cityName: profile.cityName,
        city: selectedCity,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setPending(false);
    }
  }

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>Complete your profile</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Sellers and buyers see your name in messages. Preferred city is optional — you can skip it.
      </Text>

      <Text style={[styles.label, { color: colors.muted }]}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.muted}
        autoFocus={!initial.name.trim()}
        maxLength={80}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.muted, marginTop: 14 }]}>
        Preferred city <Text style={{ fontWeight: "400" }}>(optional)</Text>
      </Text>
      {cityName && !cityQuery ? (
        <View style={[styles.pickedRow, { borderColor: colors.border }]}>
          <Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: colors.text }}>{cityName}</Text>
          <Pressable onPress={clearCity}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <BottomSheetTextInput
            value={cityQuery}
            onChangeText={(v) => void onCityQueryChange(v)}
            placeholder="Start typing your city…"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {cityQuery.trim().length > 0 && cityQuery.trim().length < MIN_CITY_QUERY && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              Type at least {MIN_CITY_QUERY} characters to search.
            </Text>
          )}
          {cityNoResults && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              No cities match — try another spelling.
            </Text>
          )}
          {cityResults.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => selectCity(c)}
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{c.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{c.state}</Text>
            </Pressable>
          ))}
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => void onContinue()}
        disabled={pending || !nameOk}
        style={[
          styles.primaryButton,
          { backgroundColor: colors.green, opacity: pending || !nameOk ? 0.5 : 1, marginTop: 16 },
        ]}
      >
        {pending ? (
          <ActivityIndicator color={colors.onGreen} />
        ) : (
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Continue</Text>
        )}
      </Pressable>

      {canSkip && (
        <Pressable onPress={onSkip} disabled={pending} style={{ marginTop: 10, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Skip for now</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: "700", fontSize: 19, marginBottom: 8 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 11.5, fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  primaryButton: {
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  error: { color: "#b3413a", fontSize: 13, marginTop: 10 },
});
