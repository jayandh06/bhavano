import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type LatLng, type MapPressEvent, type MarkerDragStartEndEvent } from "react-native-maps";
import type { ReverseGeocodeResultDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { reverseGeocodeGoogle } from "../../lib/bffClient";

/** Pin picker for the mobile posting flow — tap or drag a marker on a native map, mirroring the
 * web PostAdWizard's LocationMapPicker. Every pin move calls the BFF's reverse-geocode endpoint
 * and hands the raw lat/lng plus a City/Area *suggestion* up to the caller — never auto-locks
 * those fields itself, since Google's locality boundaries won't line up perfectly with Bhavano's
 * own Area granularity. See docs/plans/google-maps-location-picker.md. No search box here (unlike
 * web) — Places Autocomplete isn't wired up on mobile in this pass, tap/drag only. */
export function LocationMapPicker({
  defaultCenter,
  onPinChange,
}: {
  defaultCenter: { lat: number; lng: number };
  onPinChange: (pin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) => void;
}) {
  const { colors } = useAppTheme();
  const [marker, setMarker] = useState<LatLng>({ latitude: defaultCenter.lat, longitude: defaultCenter.lng });
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View>
      <MapView
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
  map: { width: "100%", height: 220, borderRadius: 10, marginTop: 6 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  hint: { fontSize: 12, marginTop: 6 },
});
