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
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import type { City, UserProfileDto } from "@bhavano/types";
import { getCityIcon } from "@bhavano/types/cityIcons";
import { useAppTheme } from "../theme/ThemeContext";
import {
  fetchCities,
  fetchCityByIp,
  fetchProfile,
  loginWithGoogle,
  logout as bffLogout,
  reverseGeocode,
  sendOtp,
  verifyOtp,
} from "../lib/bffClient";
import { useGoogleSignIn } from "../lib/googleSignIn";

const TOKEN_KEY = "bhavano.accessToken";
/** The city the user last picked, by slug-free name. AsyncStorage rather than SecureStore: this
 * is a preference, not a secret, and SecureStore has no web implementation. Mirrors web's
 * `bhavano_city` cookie — see apps/web/src/lib/defaultCity.ts. */
const CITY_KEY = "bhavano.city";

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
  /** Clears the session on this device. Safe to await — never rejects, even offline. */
  logout: () => Promise<void>;
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

  // Null until resolved, and a legitimate resting state afterwards: null means "all cities",
  // which the home screen already renders and which the listings query already treats as an
  // unfiltered search. Starting at popularCities[0] instead meant the app opened on whichever
  // city the API happened to return first, before anything had been resolved.
  const [city, setCityState] = useState<City | null>(null);
  /** Guards the one-time startup resolution below against re-running when `popularCities` lands. */
  const resolvedInitialCity = useRef(false);
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

  /**
   * Which city to open on, in the same order of preference as web's `resolveDefaultCity`:
   *
   *   1. the city this user last picked, remembered across launches
   *   2. the device's IP, on a first-ever launch
   *   3. all cities — not Bengaluru
   *
   * This used to be `find(c => c.name === "Bengaluru") ?? popularCities[0]`, so someone in
   * Chennai opened the app on Bengaluru listings however many times they had switched, and the
   * switch was forgotten again on the next launch. The web app stopped doing that when the city
   * cookie landed; the app kept doing it. See docs/plans/visitor-location-default-city.md.
   *
   * Runs once, on the first render where the city list is actually populated — `_layout.tsx`
   * passes `popularCities ?? []` while its query is in flight, so keying this to mount alone
   * would resolve against an empty list and never try again. The ref, not a `city == null`
   * check, is what makes it once: null is a legitimate answer here, and re-running on it would
   * undo the user clearing their city back to all-cities.
   */
  useEffect(() => {
    if (resolvedInitialCity.current || popularCities.length === 0) return;
    resolvedInitialCity.current = true;
    let cancelled = false;

    (async () => {
      // Matched by name against the real list rather than restored wholesale: a stored city that
      // has since been renamed or removed falls through to the next step instead of resurrecting
      // a row that no longer exists.
      const rememberedName = await AsyncStorage.getItem(CITY_KEY).catch(() => null);
      if (cancelled) return;
      if (rememberedName) {
        const remembered =
          popularCities.find((c) => c.name === rememberedName) ??
          (await fetchCities(rememberedName).catch(() => [])).find((c) => c.name === rememberedName);
        if (cancelled) return;
        if (remembered) {
          setCityState(remembered);
          return;
        }
      }

      const guess = await fetchCityByIp();
      // Only if the user has not picked one in the meantime — the lookup is a network round trip
      // and they may well have opened the picker while it was in flight.
      if (!cancelled && guess) setCityState((current) => current ?? guess);
    })();

    return () => {
      cancelled = true;
    };
  }, [popularCities]);

  useEffect(() => {
    if (popularCities.length > 0) setLocationResults(popularCities);
  }, [popularCities]);

  const setCity = useCallback((next: City) => {
    setCityState(next);
    // Fire-and-forget: failing to remember the choice is not worth blocking the sheet closing,
    // and the next launch simply falls back to the IP guess.
    AsyncStorage.setItem(CITY_KEY, next.name).catch(() => undefined);
    locationSheetRef.current?.dismiss();
  }, []);

  /** Back to browsing every city. Without this, picking a city was a one-way door: nothing in the
   * sheet could return to the unfiltered view the app can now open in, and the only way out was
   * reinstalling. Clears the remembered choice too — leaving it behind would restore the city on
   * the next launch and make this look like it had not worked. */
  const clearCity = useCallback(() => {
    setCityState(null);
    AsyncStorage.removeItem(CITY_KEY).catch(() => undefined);
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

  /** Signs the user out on this device. The BFF call is best-effort and deliberately not awaited
   * for correctness — it only gives the server a logout event to log, since JWTs are stateless and
   * cannot be revoked. What actually ends the session is deleting the stored token, so that is
   * done unconditionally: a network failure must never leave someone stuck logged in. */
  const logout = useCallback(async () => {
    const token = accessToken;
    setIsLoggedIn(false);
    setAccessToken(null);
    setProfile(null);
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    if (token) await bffLogout(token).catch(() => {});
  }, [accessToken]);

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
    () => ({ city, setCity, openLocationPicker, requireLogin, logout, isLoggedIn, accessToken, userId, profile, refreshProfile }),
    [city, setCity, openLocationPicker, requireLogin, logout, isLoggedIn, accessToken, userId, profile, refreshProfile],
  );

  return (
    <HomeSheetsContext.Provider value={value}>
      {children}

      {/* The profile-completion nudge used to live here as a position:absolute overlay pinned to
          the top of every screen, where it covered the app's own header and could not be
          dismissed. It now renders inline at the top of the home list — see
          src/components/home/ProfileCompletionBanner.tsx — so it pushes content down instead of
          occluding it, and scrolls away. `profile` stays on this context because the banner and
          the Account screen both read it. */}

      <BottomSheetModal ref={locationSheetRef} snapPoints={["70%"]} backgroundStyle={{ backgroundColor: colors.surface }}>
        {/* Scrollable, not a plain BottomSheetView: "Show more cities" replaces a short popular
            list with every city in the country, which overflows the 70% sheet. In a plain View the
            overflow is simply unreachable. BottomSheetScrollView (rather than RN's ScrollView)
            coordinates with the sheet's own pan gesture, so dragging the list scrolls it and
            dragging past the top dismisses the sheet, instead of the two fighting each other. */}
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose your location</Text>
          <Pressable
            onPress={clearCity}
            style={[
              styles.allCitiesRow,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: city ? colors.border : colors.green,
              },
            ]}
          >
            <Text style={{ color: city ? colors.text : colors.green, fontWeight: "700", fontSize: 14 }}>
              🇮🇳 All cities
            </Text>
            {!city && <Text style={{ color: colors.green, fontSize: 12 }}>Selected</Text>}
          </Pressable>
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
        </BottomSheetScrollView>
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
  allCitiesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
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
});
