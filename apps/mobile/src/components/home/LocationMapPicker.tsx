import { useEffect, useRef, useState } from "react";
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
  // Deferred by one tick rather than mounted immediately: on Android, react-native-maps' MapView
  // is backed by a SurfaceView, which attaches to the window through a different, slightly
  // async native path than ordinary views. Inserting it in the SAME commit as the "details"
  // step's whole subtree mounting at once (city row, the grouped attribute grid, price fields —
  // dozens of sibling views in one batch) raced that attach against Android's own bookkeeping of
  // the parent ViewGroup's child count and crashed with
  // "IllegalStateException: addViewAt: Failed to insert view [...] into parent [...] at index N".
  // Mounting the map into an already-settled parent, one render later, avoids the race. iOS never
  // needed this — no crash was reported there — but the guard is harmless on iOS too.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    // requestAnimationFrame, not a bare state update — see PostAdWizard's identical
    // detailsReady comment for why a plain useEffect body doesn't reliably force a real
    // native frame boundary on Android.
    const raf = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
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
      {mapReady ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          // Google's Maps SDK auto-switches to its dark tile style when the device's system
          // theme is dark, independent of this app's own `userInterfaceStyle: "light"` in
          // app.config.js (that setting only governs the app's own UI/status bar, not the native
          // map renderer, which is a separate surface). Forcing it explicitly keeps the map
          // consistent with the rest of this light-only screen regardless of device theme.
          userInterfaceStyle="light"
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
      ) : (
        // Same footprint as the map itself, so nothing shifts once it swaps in a frame later.
        <View style={[styles.map, styles.mapPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
          <ActivityIndicator size="small" color={colors.green} />
        </View>
      )}
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
  mapPlaceholder: { alignItems: "center", justifyContent: "center" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  hint: { fontSize: 12, marginTop: 6 },
});
