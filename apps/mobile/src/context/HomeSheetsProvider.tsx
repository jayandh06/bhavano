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
import { ActivityIndicator, AppState, Keyboard, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import type { City, UserProfileDto } from "@bhavano/types";
import { useAppTheme } from "../theme/ThemeContext";
import {
  BffError,
  friendlyErrorMessage,
  fetchCities,
  fetchProfile,
  fetchSellerAttention,
  loginWithApple,
  loginWithGoogle,
  logout as bffLogout,
  refreshSession,
  reverseGeocodeGoogle,
  sendOtp,
  setUnauthorizedHandler,
  verifyOtp,
} from "../lib/bffClient";
import { useGoogleSignIn } from "../lib/googleSignIn";
import { getOrCreateViewerKey } from "../lib/viewerKey";
import { getAnalyticsSessionId, linkAnalyticsSessionToUser } from "../lib/analyticsSession";
import { registerForPushAsync, unregisterPushAsync } from "../lib/push";
import { Icon } from "../components/Icon";
import { GoogleIcon } from "../components/GoogleIcon";
import { ProfileBasicsStep, basicsFromProfile, canDismissBasics, profileNeedsBasics, profileNeedsMandatoryBasics, type ProfileBasicsValues } from "../components/home/ProfileBasicsStep";
import { appWebUrl } from "../lib/appWebUrl";

// Exported so PostAdWizard can re-read the just-written token directly after a login it
// triggered mid-submit — see its own onSubmit for why a fresh read beats the accessToken prop.
export const TOKEN_KEY = "bhavano.accessToken";
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

/** Whether the JWT's own `exp` has passed — same unverified decode as {@link decodeUserId}. A token
 * with no readable `exp` counts as live; the BFF's 401 still catches it on first use. */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

/** Whether a still-valid token should be renewed: once it's a day old, or halfway through its life
 * if sooner (admin tokens last a day). Mirrors the web's isAccessTokenDueForRenewal. */
function isTokenDueForRenewal(token: string): boolean {
  try {
    const { iat, exp } = JSON.parse(atob(token.split('.')[1])) as { iat?: number; exp?: number };
    if (typeof iat !== 'number' || typeof exp !== 'number' || exp * 1000 <= Date.now()) return false;
    return Date.now() - iat * 1000 > Math.min(24 * 60 * 60 * 1000, ((exp - iat) * 1000) / 2);
  } catch {
    return false;
  }
}

export interface RequireLoginOptions {
  onSuccess?: () => void;
  skippable?: { reason: string; onSkip: () => void };
  /** Replaces the sheet's heading, for an ask about something specific ("Keep your saved homes"). */
  title?: string;
}

interface HomeSheetsContextValue {
  city: City | null;
  setCity: (city: City) => void;
  openLocationPicker: () => void;
  /** `onSuccess` resumes whatever the login interrupted, in place — same pattern as web's
   * AuthGateProvider. `skippable` is for an unprompted ask (the listing-detail login nudge): it
   * adds a reason line and a Skip button, and `onSkip` runs if the sheet closes without a login,
   * by Skip or by swiping it away. */
  requireLogin: (options?: RequireLoginOptions) => void;
  /** False until the stored session has been read on launch. `isLoggedIn` is false before that
   * even for a logged-in user, so anything that prompts on its own should wait for this. */
  sessionReady: boolean;
  /** Publish-time check. Resolves `true` when the account already has a verified phone (carry on),
   * `false` when it opened a phone-OTP sheet instead - `onSuccess` then resumes once the number is
   * verified, so the caller should just return. Login no longer collects a phone
   * (docs/plans/post-login-name-and-city.md), so a Google/Apple account reaches Publish without one. */
  ensureVerifiedPhone: (options: { accessToken: string; onSuccess: () => void }) => Promise<boolean>;
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

type LoginStep = "choose" | "phone" | "otp" | "basics";

export function HomeSheetsProvider({
  children,
  popularCities,
}: {
  children: ReactNode;
  popularCities: City[];
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  // A BottomSheetModal draws over the whole window, including under Android's gesture/3-button
  // navigation bar, so a fixed bottom padding leaves the last row (Back, primary buttons) sitting
  // beneath it. Adds the real inset on top of the sheet's own padding.
  const insets = useSafeAreaInsets();
  // Android only: tracked so the profile-basics step can pad its scroll view by the keyboard's
  // height (see that sheet below). iOS's own sheet keyboard handling already copes there.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const sheetContentStyle = [styles.sheetContent, { paddingBottom: styles.sheetContent.paddingBottom + insets.bottom }];
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
  const [sessionReady, setSessionReady] = useState(Platform.OS === "web");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [showToast, setShowToast] = useState(false);

  const [locationQuery, setLocationQuery] = useState("");
  const latestLocationQuery = useRef("");
  const [locationResults, setLocationResults] = useState<City[]>(popularCities);
  const [allCities, setAllCities] = useState<City[] | null>(null);
  const [loadingAllCities, setLoadingAllCities] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [loginStep, setLoginStep] = useState<LoginStep>("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [basicsInitial, setBasicsInitial] = useState<ProfileBasicsValues>({
    name: "",
    cityId: null,
    cityName: null,
    phone: null,
    email: null,
    emailVerified: false,
    needSecondary: null,
  });

  const googleSignIn = useGoogleSignIn();

  /** This device's Expo push token, once registered — kept so logout can unregister it while the
   * access token is still valid (the DELETE is authed). */
  const pushTokenRef = useRef<string | null>(null);

  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  /** Ends a session the BFF no longer accepts. Only when `token` is still the current one — a
   * rejection that arrives after the user has already logged in again is about the old token. */
  const endDeadSession = useCallback(async (token: string) => {
    if (token !== accessTokenRef.current) return;
    accessTokenRef.current = null;
    setIsLoggedIn(false);
    setAccessToken(null);
    setProfile(null);
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((token) => void endDeadSession(token));
    return () => setUnauthorizedHandler(null);
  }, [endDeadSession]);

  /** Swaps a day-old token for a fresh one, so someone who keeps opening the app stays logged in
   * (see docs/plans/more-login-conversion.md). A failure keeps the current, still-valid token. */
  const renewSessionIfDue = useCallback(async (token: string) => {
    if (!isTokenDueForRenewal(token)) return;
    try {
      const { accessToken: renewed } = await refreshSession(token);
      if (token !== accessTokenRef.current) return;
      accessTokenRef.current = renewed;
      setAccessToken(renewed);
      if (Platform.OS !== "web") await SecureStore.setItemAsync(TOKEN_KEY, renewed);
    } catch {
      // A 401 already ended the session through the unauthorized handler; anything else retries
      // next time the app comes forward.
    }
  }, []);

  // The app can sit in the background for days, past the token's expiry. Catch that on the way
  // back in, before the first screen fires requests that would all come back 401.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const token = accessTokenRef.current;
      if (state !== "active" || !token) return;
      if (isTokenExpired(token)) void endDeadSession(token);
      else void renewSessionIfDue(token);
    });
    return () => sub.remove();
  }, [endDeadSession, renewSessionIfDue]);

  useEffect(() => {
    // expo-secure-store has no web implementation — the browser preview simply starts logged out.
    if (Platform.OS === "web") return;
    SecureStore.getItemAsync(TOKEN_KEY).then((stored) => {
      let token = stored;
      if (token && isTokenExpired(token)) {
        token = null;
        SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      }
      setIsLoggedIn(!!token);
      setAccessToken(token);
      setSessionReady(true);
      // Cold start while already logged in — make sure this device's push token is on file (the
      // OS can rotate it, and the user may have toggled the permission in Settings).
      if (token) {
        registerForPushAsync(token).then((t) => {
          if (t) pushTokenRef.current = t;
        });
        void renewSessionIfDue(token);
      }
    });
  }, [renewSessionIfDue]);

  /**
   * Which city to open on: the city this user last picked, remembered across launches, else all
   * cities — never a guess.
   *
   * This used to be `find(c => c.name === "Bengaluru") ?? popularCities[0]`, so someone in
   * Chennai opened the app on Bengaluru listings however many times they had switched, and the
   * switch was forgotten again on the next launch. There was briefly a second step here — a
   * coarse guess from the device's IP address, run automatically on a first launch — which was
   * removed in favour of asking: "Auto-detect my current location" below now uses the device's
   * real GPS position, and only ever runs when tapped. See
   * docs/plans/remove-automatic-ip-city-detection.md.
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
      // has since been renamed or removed falls through to "all cities" instead of resurrecting
      // a row that no longer exists.
      const rememberedName = await AsyncStorage.getItem(CITY_KEY).catch(() => null);
      if (cancelled) return;
      if (rememberedName) {
        const remembered =
          popularCities.find((c) => c.name === rememberedName) ??
          (await fetchCities(rememberedName).catch(() => [])).find((c) => c.name === rememberedName);
        if (cancelled) return;
        if (remembered) setCityState(remembered);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [popularCities]);

  useEffect(() => {
    if (popularCities.length > 0) setLocationResults(popularCities);
  }, [popularCities]);

  const setCity = useCallback((next: City) => {
    Keyboard.dismiss();
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
    latestLocationQuery.current = "";
    setLocationResults(popularCities);
    setAllCities(null);
    locationSheetRef.current?.present();
  }, [popularCities]);

  async function onShowMoreCities() {
    setLoadingAllCities(true);
    setAllCities(await fetchCities(undefined, true));
    setLoadingAllCities(false);
  }

  // Tie this launch's analytics session to the signed-in user. Login only does that at the moment
  // of login; a restored session (the normal case after the first launch) never passed through it.
  useEffect(() => {
    if (accessToken) void linkAnalyticsSessionToUser(accessToken);
  }, [accessToken]);

  const refreshProfile = useCallback(async () => {
    if (!accessToken) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await fetchProfile(accessToken));
    } catch (e) {
      // A 401/403 means the stored token is dead (expired, or signed with a secret this BFF
      // doesn't share — e.g. a prod token against a local BFF). Without clearing it the app stays
      // "logged in" with no profile: the Account tab spins forever and the login sheet is
      // unreachable. So end the session here and let the user log in again. Other errors
      // (offline, 5xx) are transient — leave the session intact.
      if (e instanceof BffError && (e.status === 401 || e.status === 403)) await endDeadSession(accessToken);
    }
  }, [accessToken, endDeadSession]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const onSuccessRef = useRef<(() => void) | undefined>(undefined);
  /** Set only by a `skippable` requireLogin; cleared on login so closing the sheet afterwards
   * doesn't count as a skip. */
  const onSkipRef = useRef<(() => void) | undefined>(undefined);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [loginTitle, setLoginTitle] = useState<string | null>(null);
  /** True when basics was opened for an already-signed-in cold start, not a fresh login. */
  const quietBasicsRef = useRef(false);
  /** True while the basics sheet is being used only to verify a phone at Publish. A ref beside the
   * state because the sheet's onDismiss (a stale closure) needs the current value. */
  const verifyPhoneRef = useRef(false);
  const [verifyPhoneMode, setVerifyPhoneMode] = useState(false);
  const sessionBasicsCheckedRef = useRef(false);

  const requireLogin = useCallback((options?: RequireLoginOptions) => {
    if (isLoggedIn) return;
    onSuccessRef.current = options?.onSuccess;
    onSkipRef.current = options?.skippable?.onSkip;
    setSkipReason(options?.skippable?.reason ?? null);
    setLoginTitle(options?.title ?? null);
    quietBasicsRef.current = false;
    setLoginStep("choose");
    setPhone("");
    setOtp("");
    setError(null);
    loginSheetRef.current?.present();
  }, [isLoggedIn]);

  const ensureVerifiedPhone = useCallback(
    async (options: { accessToken: string; onSuccess: () => void }): Promise<boolean> => {
      try {
        const current = await fetchProfile(options.accessToken);
        // A phone is only ever stored once verified (OTP login or the link flow); the BFF
        // re-checks phoneVerifiedAt authoritatively on create.
        if (current.phone) return true;
        onSuccessRef.current = options.onSuccess;
        quietBasicsRef.current = false;
        verifyPhoneRef.current = true;
        setVerifyPhoneMode(true);
        setBasicsInitial({ ...basicsFromProfile(current), needSecondary: "phone" });
        setError(null);
        setPending(false);
        setLoginStep("basics");
        loginSheetRef.current?.present();
        return false;
      } catch {
        // Cannot tell - let the server's own check decide rather than blocking a valid seller.
        return true;
      }
    },
    [],
  );

  /** The city step is a one-tap confirm rather than a search: when the profile has no city yet, offer
   * the one already selected in the header (if any) as the prefilled value. */
  function withSelectedCity(basics: ProfileBasicsValues): ProfileBasicsValues {
    if (basics.cityId || !city) return basics;
    return { ...basics, cityId: city.id, cityName: city.name };
  }

  /** Cold start / already-logged-in: force a name if missing. */
  useEffect(() => {
    if (!accessToken || !profile || sessionBasicsCheckedRef.current) return;
    if (!profileNeedsMandatoryBasics(profile)) {
      sessionBasicsCheckedRef.current = true;
      return;
    }
    sessionBasicsCheckedRef.current = true;
    // Fresh login already opened basics via onLoginSuccess — don't flip to quiet mode.
    if (loginStep === "basics") return;
    quietBasicsRef.current = true;
    setBasicsInitial(withSelectedCity(basicsFromProfile(profile)));
    setError(null);
    setPending(false);
    setLoginStep("basics");
    loginSheetRef.current?.present();
  }, [accessToken, profile, loginStep]);

  async function onLocationQueryChange(value: string) {
    setLocationQuery(value);
    latestLocationQuery.current = value;
    if (!value) {
      setLocationResults(popularCities);
      return;
    }
    const results = await fetchCities(value).catch(() => []);
    // Typing fires one request per keystroke; a slower earlier one ("Ch") must not overwrite the
    // results for what's actually in the box now ("Chennai").
    if (latestLocationQuery.current === value) setLocationResults(results);
  }

  /**
   * The device's real GPS position, reverse-geocoded through Google — never an automatic guess.
   * This only ever runs from the button below being pressed. There used to be a step at app
   * startup that guessed the city from the device's IP address without being asked; that is
   * gone, and this button (which used to do its own plain nearest-city distance calculation, no
   * outside source) now goes through the same Google-backed lookup the posting flow's map picker
   * already uses. See docs/plans/remove-automatic-ip-city-detection.md.
   *
   * Only `cityId`/`cityName` come back from Google — not a full City row — so the object built
   * here is a partial one. That's fine: `state`/`lat`/`lng`/`isPopular` are never read again after
   * a city is selected (icon lookup keys on the name, the listings query keys on the id), so
   * there's nothing to lose by not doing a second round trip to fetch the row properly.
   */
  async function useAutoLocation() {
    setDetecting(true);
    setDetectError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDetectError("Location access was denied — try searching instead.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const result = await reverseGeocodeGoogle(position.coords.latitude, position.coords.longitude);
      if (result.cityId && result.cityName) {
        setCity({
          id: result.cityId,
          name: result.cityName,
          state: "",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          isPopular: false,
        });
      } else {
        setDetectError("Couldn't detect your city — try searching instead.");
      }
    } catch {
      setDetectError("Couldn't detect your city — try searching instead.");
    } finally {
      setDetecting(false);
    }
  }

  async function onLoginSuccess(accessToken: string) {
    onSkipRef.current = undefined;
    setSkipReason(null);
    if (Platform.OS !== "web") await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    setIsLoggedIn(true);
    setAccessToken(accessToken);
    // Register this device for "new message" pushes now that we have a user to attach it to.
    registerForPushAsync(accessToken).then((t) => {
      if (t) pushTokenRef.current = t;
    });

    // Name required; city optional and prefilled from the selected city — see
    // docs/plans/post-login-name-and-city.md. Keep the login sheet open for this step.
    try {
      const nextProfile = await fetchProfile(accessToken);
      setProfile(nextProfile);
      if (profileNeedsBasics(nextProfile)) {
        setBasicsInitial(withSelectedCity(basicsFromProfile(nextProfile)));
        setError(null);
        setPending(false);
        setLoginStep("basics");
        loginSheetRef.current?.present();
        return;
      }
    } catch {
      // Profile fetch failed — don't block login on the basics prompt.
    }

    finishLoginSuccess(accessToken);
  }

  function finishLoginSuccess(token: string | null = accessToken) {
    loginSheetRef.current?.dismiss();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
    // Resumes whatever action opened the login sheet (e.g. Message/View Contact on a listing
    // card) — same "onSuccess" pattern as web's AuthGateProvider.
    const resume = onSuccessRef.current;
    onSuccessRef.current = undefined;
    if (resume) {
      resume();
      return;
    }
    if (!token) return;
    void (async () => {
      try {
        const attention = await fetchSellerAttention(token);
        if (attention.pendingCheckoutCount === 0) return;
        if (attention.pendingCheckoutListingId) {
          router.push(`/my-listings?openPublishCheckout=${encodeURIComponent(attention.pendingCheckoutListingId)}`);
        } else {
          router.push("/my-listings");
        }
      } catch {
        // Best-effort routing — a failed attention fetch must not block login.
      }
    })();
  }

  function onBasicsSaved(saved: ProfileBasicsValues & { city: City | null }) {
    if (verifyPhoneRef.current) {
      const resume = onSuccessRef.current;
      onSuccessRef.current = undefined;
      verifyPhoneRef.current = false;
      setVerifyPhoneMode(false);
      void refreshProfile();
      loginSheetRef.current?.dismiss();
      resume?.();
      return;
    }
    if (saved.city) setCity(saved.city);
    void refreshProfile();
    if (quietBasicsRef.current) {
      quietBasicsRef.current = false;
      loginSheetRef.current?.dismiss();
      return;
    }
    finishLoginSuccess();
  }

  /** Signs the user out on this device. The BFF call is best-effort and deliberately not awaited
   * for correctness — it only gives the server a logout event to log, since JWTs are stateless and
   * cannot be revoked. What actually ends the session is deleting the stored token, so that is
   * done unconditionally: a network failure must never leave someone stuck logged in. */
  const logout = useCallback(async () => {
    const token = accessToken;
    // Drop this device's push token first, while the access token is still valid to authenticate
    // the (authed) delete — afterwards there's no way to identify the row to the server.
    if (token && pushTokenRef.current) {
      await unregisterPushAsync(token, pushTokenRef.current);
      pushTokenRef.current = null;
    }
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
      setError(friendlyErrorMessage(e, "Failed to send OTP"));
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyOtp() {
    setPending(true);
    setError(null);
    try {
      const session = await verifyOtp(
        phone,
        otp,
        await getOrCreateViewerKey(),
        getAnalyticsSessionId(),
      );
      await onLoginSuccess(session.accessToken);
    } catch (e) {
      // The BFF says which it was — wrong code, expired, or too many attempts — and each needs
      // different next steps, so show its message rather than always "Incorrect OTP".
      setError(friendlyErrorMessage(e, "Couldn't verify the OTP"));
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
      const session = await loginWithGoogle(
        idToken,
        await getOrCreateViewerKey(),
        getAnalyticsSessionId(),
      );
      await onLoginSuccess(session.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setPending(false);
    }
  }

  async function handleApple() {
    setPending(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return;
      // Only ever present on the very first authorization for this user+app, ever — see
      // AuthService.loginWithApple's own doc comment on why this has to be sent up now or it's
      // gone for good. `undefined`, not "", when both name parts are missing (a later login),
      // so the BFF's own `fullName &&` check treats it the same as never having sent one.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      const session = await loginWithApple(
        credential.identityToken,
        fullName || undefined,
        await getOrCreateViewerKey(),
        getAnalyticsSessionId(),
      );
      await onLoginSuccess(session.accessToken);
    } catch (e) {
      // ERR_REQUEST_CANCELED — the user dismissed the Apple sheet, same as Google's own
      // no-idToken-returned case above: not an error worth surfacing. Expo's own docs check
      // `e.code`, not `e.message` — this isn't a plain Error.
      if (e && typeof e === "object" && "code" in e && e.code === "ERR_REQUEST_CANCELED") return;
      setError(e instanceof Error ? e.message : "Apple sign-in failed");
    } finally {
      setPending(false);
    }
  }

  const userId = useMemo(() => (accessToken ? decodeUserId(accessToken) : null), [accessToken]);

  const value = useMemo(
    () => ({ city, setCity, openLocationPicker, requireLogin, sessionReady, ensureVerifiedPhone, logout, isLoggedIn, accessToken, userId, profile, refreshProfile }),
    [city, setCity, openLocationPicker, requireLogin, sessionReady, ensureVerifiedPhone, logout, isLoggedIn, accessToken, userId, profile, refreshProfile],
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

      {/* Same keyboard props as the login sheet below: without adjustResize the Android keyboard
        * sat over the search results, so a typed city couldn't be reached to tap. */}
      <BottomSheetModal
        ref={locationSheetRef}
        snapPoints={["70%"]}
        backgroundStyle={{ backgroundColor: colors.surface }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {/* Scrollable, not a plain BottomSheetView: "Show more cities" replaces a short popular
            list with every city in the country, which overflows the 70% sheet. In a plain View the
            overflow is simply unreachable. BottomSheetScrollView (rather than RN's ScrollView)
            coordinates with the sheet's own pan gesture, so dragging the list scrolls it and
            dragging past the top dismisses the sheet, instead of the two fighting each other. */}
        {/* "handled": with the search keyboard open, the default ("never") spent the first tap on
          * a result just closing the keyboard, so picking a searched city looked like it did
          * nothing. */}
        <BottomSheetScrollView contentContainerStyle={sheetContentStyle} keyboardShouldPersistTaps="handled">
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="allCities" size={15} color={city ? colors.text : colors.green} />
              <Text style={{ color: city ? colors.text : colors.green, fontWeight: "700", fontSize: 14 }}>
                All cities
              </Text>
            </View>
            {!city && <Text style={{ color: colors.green, fontSize: 12 }}>Selected</Text>}
          </Pressable>
          <Pressable
            onPress={useAutoLocation}
            style={[styles.autoDetectButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            {detecting ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="pin" size={15} color={colors.green} />
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>
                  Auto-detect my current location
                </Text>
              </View>
            )}
          </Pressable>
          {detectError ? (
            <Text style={{ color: "#c0554b", fontSize: 12, marginTop: 6, marginBottom: 4 }}>{detectError}</Text>
          ) : null}
          <Text style={[styles.sheetLabel, { color: colors.muted }]}>OR SEARCH CITY / AREA / PINCODE</Text>
          <BottomSheetTextInput
            value={locationQuery}
            onChangeText={onLocationQueryChange}
            placeholder="e.g. Koramangala, Bangalore or 560034"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {locationQuery || !allCities ? (
            locationResults.map((c) => (
              <Pressable key={c.id} onPress={() => setCity(c)} style={styles.cityRow}>
                <Text style={{ color: colors.text, fontSize: 14 }}>{c.name}</Text>
              </Pressable>
            ))
          ) : (
            <>
              <Text style={[styles.sheetLabel, { color: colors.muted, marginTop: 4 }]}>POPULAR</Text>
              {allCities
                .filter((c) => c.isPopular)
                .map((c) => (
                  <Pressable key={c.id} onPress={() => setCity(c)} style={styles.cityRow}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{c.name}</Text>
                  </Pressable>
                ))}
              <Text style={[styles.sheetLabel, { color: colors.muted, marginTop: 10 }]}>MORE CITIES</Text>
              {allCities
                .filter((c) => !c.isPopular && c.isServed)
                .map((c) => (
                  <Pressable key={c.id} onPress={() => setCity(c)} style={styles.cityRow}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{c.name}</Text>
                  </Pressable>
                ))}
            </>
          )}
          {!locationQuery && !allCities && (
            <Pressable
              onPress={onShowMoreCities}
              disabled={loadingAllCities}
              style={{ paddingVertical: 10, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>
                {loadingAllCities ? "Loading…" : "Show more cities"}
              </Text>
              {!loadingAllCities && <Icon name="chevronDown" size={13} color={colors.green} />}
            </Pressable>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* keyboardBehavior/android_keyboardInputMode/keyboardBlurBehavior — without these, the
        * number-pad keyboard for the phone/OTP steps below just overlapped whatever sat in the
        * bottom half of this sheet's fixed 55% height, with nothing pushing the sheet or its
        * content up to stay visible above it. "interactive" tracks the keyboard's own show/hide
        * animation instead of jumping; adjustResize is the Android-specific half of this (iOS
        * gorhom handles automatically, Android needs the window's own resize mode set). */}
      <BottomSheetModal
        ref={loginSheetRef}
        snapPoints={loginStep === "basics" ? ["85%"] : skipReason ? ["65%"] : ["55%"]}
        // Name is mandatory — don't swipe away an incomplete profile.
        // City-only gaps may dismiss (canDismissBasics).
        enablePanDownToClose={loginStep !== "basics" || verifyPhoneMode || canDismissBasics(basicsInitial)}
        onDismiss={() => {
          const onSkip = onSkipRef.current;
          onSkipRef.current = undefined;
          if (onSkip) {
            onSuccessRef.current = undefined;
            setSkipReason(null);
            onSkip();
          }
          // Swiped/cancelled out of the Publish-time phone check: drop the pending resume so it
          // cannot fire later (a completed check clears these itself before dismissing).
          if (!verifyPhoneRef.current) return;
          verifyPhoneRef.current = false;
          onSuccessRef.current = undefined;
          setVerifyPhoneMode(false);
        }}
        backgroundStyle={{ backgroundColor: colors.surface }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {loginStep === "basics" ? (
          // Its own scroll view, and no KeyboardAvoidingView. The step re-snaps the sheet 55% ->
          // 85% as it swaps in, and a KeyboardAvoidingView re-measuring its offset against the
          // moving sheet made the screen jump up and down; with it off, the keyboard just covered
          // the fields. Here the keyboard's height is plain bottom padding inside a scroll view
          // sized by the sheet, so nothing feeds back into the sheet's own position and the
          // buttons below the keyboard can always be scrolled into reach.
          <BottomSheetScrollView
            contentContainerStyle={[sheetContentStyle, { paddingBottom: sheetContentStyle[1].paddingBottom + keyboardHeight }]}
            keyboardShouldPersistTaps="handled"
          >
          {accessToken && (
            <ProfileBasicsStep
              accessToken={accessToken}
              initial={basicsInitial}
              onSaved={onBasicsSaved}
              verifyPhoneOnly={verifyPhoneMode}
              onCancel={() => loginSheetRef.current?.dismiss()}
              onSkip={() => {
                if (quietBasicsRef.current) {
                  quietBasicsRef.current = false;
                  loginSheetRef.current?.dismiss();
                  return;
                }
                finishLoginSuccess();
              }}
              onReauthRequired={() => {
                loginSheetRef.current?.dismiss();
                void logout();
              }}
            />
          )}
          </BottomSheetScrollView>
        ) : (
        <BottomSheetView style={sheetContentStyle}>
        {/* KeyboardAvoidingView, not gorhom's own android_keyboardInputMode="adjustResize" alone
            (still set above, harmless to leave) — that prop depends on Android's window actually
            resizing in response to the keyboard, which SDK 54's mandatory edge-to-edge breaks, the
            same root cause already fixed for the long-form screens (see PostAdWizard.tsx/
            account.tsx's identical comment). Android-only: iOS's keyboardBehavior="interactive"
            already works correctly here (gorhom handles it natively there), and wrapping iOS in
            this too risks the two mechanisms fighting over the same space. */}
        <KeyboardAvoidingView
          // Stays on for the profile-basics step too. It was briefly disabled there to stop the
          // screen jumping, but that only let the keyboard cover the fields — the jumping's real
          // trigger was the inputs auto-focusing mid-way through the sheet's 55% -> 85% re-snap
          // (now delayed, see ProfileBasicsStep's focusAfterSheetSettles), not this component.
          behavior={Platform.OS === "android" ? "padding" : undefined}
          // Without this, "padding" still applies but computes against the wrong reference point —
          // by default this assumes it sits flush against the true top of the screen, which a
          // BottomSheetModal's content never does (it's offset by wherever the sheet's snap point
          // puts it). This is the specific case the prop's own doc comment names ("modals").
          automaticOffset
        >
          {loginStep === "choose" && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }, skipReason ? { marginBottom: 6 } : null]}>
                {loginTitle ?? (skipReason ? "Log in to hear back from owners faster" : "Log in to continue")}
              </Text>
              {skipReason && (
                <Text style={{ fontSize: 13, color: colors.textSoft, marginBottom: 16, lineHeight: 19 }}>{skipReason}</Text>
              )}
              <Pressable onPress={() => setLoginStep("phone")} style={[styles.primaryButton, { backgroundColor: colors.green }]}>
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Continue with Phone OTP</Text>
              </Pressable>
              {/* iOS-only, and still shown above Google even though Phone OTP now leads —
                * Apple requires Sign in with Apple to have equal or greater prominence than any
                * other *third-party* login offered (Guideline 4.8); Phone OTP is this app's own
                * credential system, not a third-party identity provider, so it isn't what that
                * rule is about. Apple's own button component, not a custom one: their HIG
                * requires using either this or a button that strictly matches its design, and
                * this guarantees that. See docs/plans/ios-app-store-release.md. */}
              {Platform.OS === "ios" && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={9}
                  style={styles.appleButton}
                  onPress={handleApple}
                />
              )}
              <Pressable onPress={handleGoogle} disabled={pending} style={[styles.outlineButton, { borderColor: colors.border }]}>
                <GoogleIcon size={18} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Continue with Google</Text>
              </Pressable>
              {/* Same wording/links as the web login dialog's own disclaimer. */}
              <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
                By continuing you agree to Bhavano&apos;s{" "}
                <Text
                  style={{ color: colors.textSoft, fontWeight: "700" }}
                  onPress={() => Linking.openURL(appWebUrl("/terms"))}
                >
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text
                  style={{ color: colors.textSoft, fontWeight: "700" }}
                  onPress={() => Linking.openURL(appWebUrl("/privacy"))}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
              {error && <Text style={styles.errorText}>{error}</Text>}
              {skipReason && (
                <Pressable onPress={() => loginSheetRef.current?.dismiss()} style={{ alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16 }}>
                  <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 14 }}>Skip for now</Text>
                </Pressable>
              )}
            </>
          )}

          {loginStep === "phone" && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Enter your phone number</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                <View style={[styles.countryChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>+91</Text>
                </View>
                <BottomSheetTextInput
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
              <Pressable
                onPress={() => setLoginStep("choose")}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
              >
                <Icon name="chevronLeft" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Back</Text>
              </Pressable>
            </>
          )}

          {loginStep === "otp" && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Enter the OTP</Text>
              <BottomSheetTextInput
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
              <Pressable
                onPress={() => setLoginStep("phone")}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
              >
                <Icon name="chevronLeft" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Back</Text>
              </Pressable>
            </>
          )}
        </KeyboardAvoidingView>
        </BottomSheetView>
        )}
      </BottomSheetModal>

      {showToast && (
        <View style={[styles.toast, { flexDirection: "row", alignItems: "center", gap: 6 }]} pointerEvents="none">
          <Icon name="check" size={15} color="#F5F1E6" />
          <Text style={{ color: "#F5F1E6", fontWeight: "600", fontSize: 14 }}>Logged in successfully</Text>
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
  // Apple's own button sizes itself via style's height/width, not padding — matches
  // outlineButton's effective height (13 vertical padding × 2 + line height) and spacing below.
  appleButton: { width: "100%", height: 46, marginBottom: 12 },
  outlineButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 13,
    marginBottom: 12,
  },
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
