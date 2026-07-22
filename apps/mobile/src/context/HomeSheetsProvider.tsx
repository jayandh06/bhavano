import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import type { City, UserProfileDto } from "@bhavano/types";
import { getCityIcon } from "@bhavano/types/cityIcons";
import { useAppTheme } from "../theme/ThemeContext";
import { fetchCities, fetchProfile, loginWithGoogle, reverseGeocode, sendOtp, verifyOtp } from "../lib/bffClient";
import { useGoogleSignIn } from "../lib/googleSignIn";

const TOKEN_KEY = "bhavano.accessToken";

/** Decodes the JWT payload without verifying — fine for local display purposes only;
 * the BFF independently verifies the token's signature on every request. */
function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

interface HomeSheetsContextValue {
  city: City | null;
  setCity: (city: City) => void;
  openLocationPicker: () => void;
  requireLogin: () => void;
  isLoggedIn: boolean;
  accessToken: string | null;
  userId: string | null;
  /** Null until fetched (or if logged out). Account screen re-triggers a refetch via
   * refreshProfile() after a successful save, so the global completion banner updates
   * immediately without waiting for a remount. */
  profile: UserProfileDto | null;
  refreshProfile: () => Promise<void>;
}

const HomeSheetsContext = createContext<HomeSheetsContextValue | null>(null);

export function useHomeSheets(): HomeSheetsContextValue {
  const ctx = useContext(HomeSheetsContext);
  if (!ctx) throw new Error("useHomeSheets must be used within HomeSheetsProvider");
  return ctx;
}

type LoginStep = "choose" | "phone" | "otp";

export function HomeSheetsProvider({
  children,
  popularCities,
}: {
  children: ReactNode;
  popularCities: City[];
}) {
  const { colors } = useAppTheme();
  const locationSheetRef = useRef<BottomSheetModal>(null);
  const loginSheetRef = useRef<BottomSheetModal>(null);

  const [city, setCityState] = useState<City | null>(popularCities[0] ?? null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [showToast, setShowToast] = useState(false);

  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<City[]>(popularCities);
  const [allCities, setAllCities] = useState<City[] | null>(null);
  const [loadingAllCities, setLoadingAllCities] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const [loginStep, setLoginStep] = useState<LoginStep>("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleSignIn = useGoogleSignIn();

  useEffect(() => {
    // expo-secure-store has no web implementation — the browser preview simply starts logged out.
    if (Platform.OS === "web") return;
    SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
      setIsLoggedIn(!!token);
      setAccessToken(token);
    });
  }, []);

  useEffect(() => {
    if (!city && popularCities.length > 0) {
      setCityState(popularCities.find((c) => c.name === "Bengaluru") ?? popularCities[0]);
      setLocationResults(popularCities);
    }
  }, [city, popularCities]);

  const setCity = useCallback((next: City) => {
    setCityState(next);
    locationSheetRef.current?.dismiss();
  }, []);

  const openLocationPicker = useCallback(() => {
    setLocationQuery("");
    setLocationResults(popularCities);
    setAllCities(null);
    locationSheetRef.current?.present();
  }, [popularCities]);

  async function onShowMoreCities() {
    setLoadingAllCities(true);
    setAllCities(await fetchCities(undefined, true));
    setLoadingAllCities(false);
  }

  const refreshProfile = useCallback(async () => {
    if (!accessToken) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await fetchProfile(accessToken));
    } catch {
      // Best-effort — a stale/invalid token here just means the completion banner won't show;
      // the user will hit the normal auth handling wherever they next use the token.
    }
  }, [accessToken]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const requireLogin = useCallback(() => {
    if (isLoggedIn) return;
    setLoginStep("choose");
    setPhone("");
    setOtp("");
    setError(null);
    loginSheetRef.current?.present();
  }, [isLoggedIn]);

  async function onLocationQueryChange(value: string) {
    setLocationQuery(value);
    if (!value) {
      setLocationResults(popularCities);
      return;
    }
    setLocationResults(await fetchCities(value));
  }

  async function useAutoLocation() {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      const nearest = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      if (nearest) setCity(nearest);
    } finally {
      setDetecting(false);
    }
  }

  async function onLoginSuccess(accessToken: string) {
    if (Platform.OS !== "web") await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    setIsLoggedIn(true);
    setAccessToken(accessToken);
    loginSheetRef.current?.dismiss();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  }

  async function handleSendOtp() {
    setPending(true);
    setError(null);
    try {
      await sendOtp(phone);
      setLoginStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyOtp() {
    setPending(true);
    setError(null);
    try {
      const session = await verifyOtp(phone, otp);
      await onLoginSuccess(session.accessToken);
    } catch {
      setError("Incorrect OTP");
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setPending(true);
    setError(null);
    try {
      const idToken = await googleSignIn();
      if (!idToken) return;
      const session = await loginWithGoogle(idToken);
      await onLoginSuccess(session.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setPending(false);
    }
  }

  const userId = useMemo(() => (accessToken ? decodeUserId(accessToken) : null), [accessToken]);

  const value = useMemo(
    () => ({ city, setCity, openLocationPicker, requireLogin, isLoggedIn, accessToken, userId, profile, refreshProfile }),
    [city, setCity, openLocationPicker, requireLogin, isLoggedIn, accessToken, userId, profile, refreshProfile],
  );

  return (
    <HomeSheetsContext.Provider value={value}>
      {children}

      {profile && (!profile.email || !profile.phone) && (
        <View style={[styles.completionBanner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSoft, fontSize: 12.5, textAlign: "center" }}>
            Add your {[!profile.email && "email", !profile.phone && "phone number"].filter(Boolean).join(" and ")} to
            your profile so we can keep you updated.
          </Text>
        </View>
      )}

      <BottomSheetModal ref={locationSheetRef} snapPoints={["70%"]} backgroundStyle={{ backgroundColor: colors.surface }}>
        <BottomSheetView style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose your location</Text>
          <Pressable
            onPress={useAutoLocation}
            style={[styles.autoDetectButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            {detecting ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>
                📍 Auto-detect my current location
              </Text>
            )}
          </Pressable>
          <Text style={[styles.sheetLabel, { color: colors.muted }]}>OR SEARCH CITY / AREA / PINCODE</Text>
          <TextInput
            value={locationQuery}
            onChangeText={onLocationQueryChange}
            placeholder="e.g. Koramangala, Bangalore or 560034"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {locationQuery || !allCities ? (
            locationResults.map((c) => (
              <Pressable key={c.id} onPress={() => setCity(c)} style={styles.cityRow}>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {getCityIcon(c.name)} {c.name}
                </Text>
              </Pressable>
            ))
          ) : (
            <>
              <Text style={[styles.sheetLabel, { color: colors.muted, marginTop: 4 }]}>POPULAR</Text>
              {allCities
                .filter((c) => c.isPopular)
                .map((c) => (
                  <Pressable key={c.id} onPress={() => setCity(c)} style={styles.cityRow}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {getCityIcon(c.name)} {c.name}
                    </Text>
                  </Pressable>
                ))}
              <Text style={[styles.sheetLabel, { color: colors.muted, marginTop: 10 }]}>MORE CITIES</Text>
              {allCities
                .filter((c) => !c.isPopular)
                .map((c) => (
                  <Pressable key={c.id} onPress={() => setCity(c)} style={styles.cityRow}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {getCityIcon(c.name)} {c.name}
                    </Text>
                  </Pressable>
                ))}
            </>
          )}
          {!locationQuery && !allCities && (
            <Pressable onPress={onShowMoreCities} disabled={loadingAllCities} style={{ paddingVertical: 10, paddingHorizontal: 6 }}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>
                {loadingAllCities ? "Loading…" : "Show more cities ▾"}
              </Text>
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal ref={loginSheetRef} snapPoints={["55%"]} backgroundStyle={{ backgroundColor: colors.surface }}>
        <BottomSheetView style={styles.sheetContent}>
          {loginStep === "choose" && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Log in to continue</Text>
              <Pressable onPress={() => setLoginStep("phone")} style={[styles.primaryButton, { backgroundColor: colors.green }]}>
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Continue with Phone OTP</Text>
              </Pressable>
              <Pressable onPress={handleGoogle} disabled={pending} style={[styles.outlineButton, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>G  Continue with Google</Text>
              </Pressable>
              {error && <Text style={styles.errorText}>{error}</Text>}
            </>
          )}

          {loginStep === "phone" && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Enter your phone number</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                <View style={[styles.countryChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>+91</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                onPress={handleSendOtp}
                disabled={phone.length !== 10 || pending}
                style={[styles.primaryButton, { backgroundColor: colors.green, opacity: phone.length === 10 ? 1 : 0.5 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Send OTP</Text>
              </Pressable>
              <Pressable onPress={() => setLoginStep("choose")}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, marginTop: 4 }}>← Back</Text>
              </Pressable>
            </>
          )}

          {loginStep === "otp" && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Enter the OTP</Text>
              <TextInput
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="······"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  { textAlign: "center", letterSpacing: 8, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                ]}
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                onPress={handleVerifyOtp}
                disabled={otp.length !== 6 || pending}
                style={[styles.primaryButton, { backgroundColor: colors.green, opacity: otp.length === 6 ? 1 : 0.5 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Verify & continue</Text>
              </Pressable>
              <Pressable onPress={() => setLoginStep("phone")}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, marginTop: 4 }}>← Back</Text>
              </Pressable>
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>

      {showToast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={{ color: "#F5F1E6", fontWeight: "600", fontSize: 14 }}>✓ Logged in successfully</Text>
        </View>
      )}
    </HomeSheetsContext.Provider>
  );
}

const styles = StyleSheet.create({
  sheetContent: { paddingHorizontal: 20, paddingBottom: 24 },
  sheetTitle: { fontWeight: "700", fontSize: 19, marginBottom: 16 },
  sheetLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  autoDetectButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 14,
  },
  cityRow: { paddingVertical: 10, paddingHorizontal: 6 },
  primaryButton: { borderRadius: 8, paddingVertical: 13, alignItems: "center", marginBottom: 10 },
  outlineButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 13, alignItems: "center" },
  countryChip: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, justifyContent: "center" },
  errorText: { color: "#c0554b", fontSize: 13, marginBottom: 10 },
  toast: {
    position: "absolute",
    bottom: 100,
    left: "20%",
    right: "20%",
    backgroundColor: "#242420",
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  completionBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
