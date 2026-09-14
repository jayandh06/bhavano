import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, type LatLng, type MapPressEvent, type MarkerDragStartEndEvent } from "react-native-maps";
import type { PlaceAutocompletePrediction, ReverseGeocodeResultDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { placeAutocomplete, resolvePlaceId, reverseGeocodeGoogle } from "../../lib/bffClient";

const SEARCH_DEBOUNCE_MS = 300;

/** Pin picker for the mobile posting flow — tap or drag a marker on a native map, or search for
 * an address/landmark, mirroring the web PostAdWizard's LocationMapPicker. Every pin move (drag,
 * tap, or a picked search result) calls the BFF's reverse-geocode endpoint and hands the raw
 * lat/lng plus a City/Area *suggestion* up to the caller — never auto-locks those fields itself,
 * since Google's locality boundaries won't line up perfectly with Bhavano's own Area
 * granularity. See docs/plans/google-maps-location-picker.md.
 *
 * The search box proxies Google's Places Autocomplete + Place Details through the BFF
 * (place-autocomplete/place-details) rather than the Places JS SDK web uses client-side — a
 * distributed app binary can't safely embed a key the way a referrer-restricted browser key can,
 * same reasoning as the static-map proxy. */
export function LocationMapPicker({
  defaultCenter,
  onPinChange,
}: {
  defaultCenter: { lat: number; lng: number };
  onPinChange: (pin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) => void;
}) {
  const { colors } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const [marker, setMarker] = useState<LatLng>({ latitude: defaultCenter.lat, longitude: defaultCenter.lng });
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PlaceAutocompletePrediction[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handlePinMove(coordinate: LatLng) {
    setMarker(coordinate);
    onPinChange({ lat: coordinate.latitude, lng: coordinate.longitude }, null);
    setResolving(true);
    setError(null);
    try {
      const suggestion = await reverseGeocodeGoogle(coordinate.latitude, coordinate.longitude);
      onPinChange({ lat: coordinate.latitude, lng: coordinate.longitude }, suggestion);
    } catch {
      setError("Couldn't look up that location — you can still pick a city/area below.");
    } finally {
      setResolving(false);
    }
  }

  function onSearchQueryChange(value: string) {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) {
      setPredictions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        setPredictions(await placeAutocomplete(value));
      } catch {
        setPredictions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  async function onPickPrediction(prediction: PlaceAutocompletePrediction) {
    setSearchQuery(prediction.description);
    setPredictions([]);
    setResolving(true);
    setError(null);
    try {
      const result = await resolvePlaceId(prediction.placeId);
      const coordinate: LatLng = { latitude: result.lat, longitude: result.lng };
      setMarker(coordinate);
      mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 400);
      onPinChange({ lat: result.lat, lng: result.lng }, result);
    } catch {
      setError("Couldn't look up that place — you can still tap the map or pick a city/area below.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <View>
      <View>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search for an address or landmark…"
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
        />
        {predictions.length > 0 && (
          <View style={[styles.suggestionsBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {predictions.map((p) => (
              <Pressable key={p.placeId} onPress={() => onPickPrediction(p)} style={styles.suggestionRow}>
                <Text style={{ color: colors.text, fontSize: 13.5 }} numberOfLines={1}>
                  {p.description}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: defaultCenter.lat,
          longitude: defaultCenter.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={(e: MapPressEvent) => handlePinMove(e.nativeEvent.coordinate)}
      >
        <Marker
          coordinate={marker}
          draggable
          onDragEnd={(e: MarkerDragStartEndEvent) => handlePinMove(e.nativeEvent.coordinate)}
        />
      </MapView>
      {resolving && (
        <View style={styles.hintRow}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={[styles.hint, { color: colors.muted }]}>Looking up this location…</Text>
        </View>
      )}
      {error && <Text style={[styles.hint, { color: "#c0554b" }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
  suggestionsBox: { borderWidth: 1, borderRadius: 9, marginTop: 4, overflow: "hidden" },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 14 },
  map: { width: "100%", height: 220, borderRadius: 10, marginTop: 8 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  hint: { fontSize: 12, marginTop: 6 },
});
