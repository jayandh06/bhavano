import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { City, ReverseGeocodeResultDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { ErrorBoundary } from "../ErrorBoundary";
import { LocationMapPicker } from "./LocationMapPicker";

/** A location chosen on the map, complete enough to save: the pin, the city it falls in and the area
 * (an existing one by id, or a name to create under the city). */
export interface ListingLocationChange {
  lat: number;
  lng: number;
  cityId: string;
  areaId?: string;
  areaName?: string;
}

/** Move a listing on the map. City and area are never typed: they come from where the pin lands, and
 * the listing's page address follows them (the old address redirects). Reports `null` while the pin
 * is untouched or not yet resolved, so the screen can hold Save. Mirrors the web
 * ListingLocationEditor. See docs/plans/mandatory-pin-and-owner-location-edit.md. */
export function ListingLocationEditor({
  cityName,
  areaName,
  cityId,
  initialPin,
  cities,
  onChange,
}: {
  cityName: string;
  areaName: string;
  cityId: string;
  initialPin: { lat: number; lng: number } | null;
  /** For the fallback city choice when a pin lands outside every city we list. */
  cities: City[];
  onChange: (change: ListingLocationChange | null, moved: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const [moved, setMoved] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [resolved, setResolved] = useState<{ cityId?: string; cityName?: string; areaId?: string; areaName: string } | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [fallbackCityId, setFallbackCityId] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initialPin);

  function report(
    nextPin: { lat: number; lng: number } | null,
    r: { cityId?: string; areaId?: string; areaName: string } | null,
    pickedCity: string,
  ) {
    const effectiveCity = r?.cityId ?? pickedCity;
    if (!nextPin || !r || !r.areaName || !effectiveCity) {
      onChange(null, true);
      return;
    }
    onChange(
      {
        lat: nextPin.lat,
        lng: nextPin.lng,
        cityId: effectiveCity,
        ...(r.areaId ? { areaId: r.areaId } : { areaName: r.areaName }),
      },
      true,
    );
  }

  function onPinChange(nextPin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) {
    setPin(nextPin);
    setMoved(true);
    if (!suggestion) {
      setLookingUp(true);
      onChange(null, true);
      return;
    }
    setLookingUp(false);
    const next = {
      cityId: suggestion.cityId,
      cityName: suggestion.cityName,
      areaId: suggestion.areaId,
      areaName: suggestion.resolvedLocality,
    };
    setResolved(next);
    setAlternatives(suggestion.areaAlternatives ?? []);
    if (suggestion.cityId) setFallbackCityId("");
    report(nextPin, next, suggestion.cityId ? "" : fallbackCityId);
  }

  const noCityForPin = moved && !lookingUp && !!resolved && !resolved.cityId;
  const unreadable = moved && !lookingUp && !!resolved && !resolved.areaName;
  const shownCity = resolved?.cityId
    ? resolved.cityName ?? cities.find((c) => c.id === resolved.cityId)?.name ?? cityName
    : noCityForPin
      ? cities.find((c) => c.id === fallbackCityId)?.name ?? "Choose the nearest city below"
      : cityName;
  const shownArea = moved && resolved ? resolved.areaName || "Move the pin a little" : areaName;

  return (
    <View>
      <Text style={[styles.label, { color: colors.textSoft }]}>Location</Text>
      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
        Search an address or drag the pin to where the property is. City and area are set from the pin, and the
        listing&apos;s page address updates to match.
      </Text>
      <ErrorBoundary
        fallback={
          <Text style={{ fontSize: 12.5, color: colors.muted, fontStyle: "italic" }}>
            Map unavailable right now. Try again later to change the location.
          </Text>
        }
      >
        <LocationMapPicker
          defaultCenter={initialPin ?? cities.find((c) => c.id === cityId) ?? cities[0] ?? { lat: 20.5937, lng: 78.9629 }}
          initialPin={initialPin}
          onPinChange={onPinChange}
        />
      </ErrorBoundary>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>City</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{shownCity}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Area</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{lookingUp ? "Looking up…" : shownArea}</Text>
        </View>
      </View>
      {alternatives.length > 0 && moved ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Not right? Use: </Text>
          {alternatives.map((name) => (
            <Pressable
              key={name}
              onPress={() => {
                const next = { cityId: resolved?.cityId, cityName: resolved?.cityName, areaName: name };
                setResolved(next);
                report(pin, next, fallbackCityId);
              }}
              style={{ marginRight: 10 }}
            >
              <Text style={{ fontSize: 12, color: colors.muted, textDecorationLine: "underline" }}>{name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {noCityForPin ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>
            This place isn&apos;t inside a city we list. Choose the nearest city.
          </Text>
          <View style={styles.chipRow}>
            {cities.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setFallbackCityId(c.id);
                  report(pin, resolved, c.id);
                }}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: fallbackCityId === c.id ? colors.surfaceAlt : "transparent" },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {unreadable ? (
        <Text style={{ fontSize: 12, color: "#b3413a", marginTop: 6 }}>
          We couldn&apos;t read an area for that spot. Move the pin a little or search the address.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
});
