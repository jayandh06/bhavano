import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest, ResponseType, Prompt } from "expo-auth-session";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/** Turns "1234-abc.apps.googleusercontent.com" into "com.googleusercontent.apps.1234-abc" — the
 * reversed-DNS URL scheme Google registers for native OAuth clients, and the only redirect they
 * will accept from an iOS app. The scheme is also declared in app.config.js, without which iOS
 * has no way to route the callback back into the app.
 *
 * iOS only: Android reaches this function's *caller*, useGoogleSignIn, but never this function
 * itself any more — see that hook's own doc comment for why. */
function nativeRedirectUri(clientId: string): string {
  const scheme = clientId.split(".").reverse().join(".");
  return `${scheme}:/oauthredirect`;
}

let androidConfigured = false;

/** `GoogleSignin.configure` is cheap and idempotent, but there's no reason to call it more than
 * once per app session — this just avoids doing so on every sign-in tap. */
function configureAndroidGoogleSignInOnce() {
  if (androidConfigured) return;
  androidConfigured = true;
  GoogleSignin.configure({
    // The *Web* OAuth client, not the Android one — Google only returns an ID token (rather than
    // just an authorization code) when configured against a Web-type client; see
    // EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID's own comment in apps/mobile/.env.example. The Android
    // client is still what Play Services validates the app's identity against (via its
    // package name + SHA-1, already registered in Google Cloud Console) — it's just never named
    // directly in this file, unlike the iOS/web branch below.
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  });
}

/**
 * Google sign-in. Returns an `id_token` for the BFF's POST /auth/google, or null if the user
 * cancelled. Two entirely different mechanisms depending on platform — they share nothing but
 * this hook's external shape (a callback returning the same promise type), which is why both
 * are folded into one export rather than two.
 *
 * **Android: native Google Sign-In (@react-native-google-signin/google-signin), not a browser
 * redirect.** Google deprecated custom-URI-scheme redirects for Android OAuth clients — the
 * browser flow below now fails outright with "Error 400: invalid_request / Custom URI scheme is
 * not enabled for your Android client", confirmed live, not merely documented. There is no
 * Cloud-Console setting that re-enables it; Google's own docs say the mechanism is gone for
 * Android/Chrome apps, full stop. The native module calls Play Services' account picker directly
 * — no browser, no redirect URL, so the restriction doesn't apply to it at all.
 *
 * **iOS (and web): the generic AuthSession browser-redirect flow, unchanged.** iOS carries no
 * such restriction and this already works there; there is no reason to move it onto the native
 * module too and take on that migration's risk for a platform that isn't broken.
 *
 * **Authorization code + PKCE, not implicit** (iOS/web branch only). Google supports only
 * `response_type=code` for installed apps — `id_token` implicit responses are rejected outright.
 * See https://developers.google.com/identity/protocols/oauth2/native-app. That costs a second
 * round trip (exchangeCodeAsync below) because the id_token arrives from the token endpoint
 * rather than the redirect, but it is the only shape Google accepts here.
 *
 * No client secret is used or needed on either path: native clients are public, and PKCE (iOS) /
 * Play Services' own app attestation (Android) — not a secret — is what proves the app requesting
 * the token is the one Google issued credentials to.
 */
export function useGoogleSignIn() {
  // Platform-specific, not a fallback chain — that was a real, separate bug fixed earlier: the
  // old `EXPO || IOS || ANDROID` chain picks the first non-empty value on every platform, and
  // since EXPO_CLIENT_ID was unset, it always resolved to IOS_CLIENT_ID regardless of platform.
  //
  // Meaningless on Android now — the native branch below never reads this — but still computed
  // unconditionally because useAuthRequest (next) is a hook and must be called on every render
  // regardless of platform; Platform.OS itself is stable for the lifetime of a build, so this
  // doesn't run afoul of the rules of hooks the way branching on props/state would.
  const clientId =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || ""
      : Platform.OS === "android"
        ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ""
        : // Web has no client of its own configured yet — EXPO_CLIENT_ID stays empty until one
          // exists, at which point this is where it plugs in.
          process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "";

  // Built once and reused for both legs: Google requires the redirect_uri sent to the token
  // endpoint to be byte-identical to the one on the authorization request, or the exchange fails.
  //
  // NOT makeRedirectUri({ native: ... }) — that helper only returns `native` verbatim when
  // Constants.executionEnvironment reports Standalone/Bare, and an EAS development-client build
  // does not reliably report either (a long-documented inconsistency across Expo SDK versions).
  // The condition silently fell through to Linking.createURL(''), which built a redirect from
  // this app's own "bhavano" scheme instead — Google dutifully sent the code back to
  // "bhavano://oauthredirect", a URL Expo Router has no matching route for and this app never
  // asked Google to use in the first place, showing "Unmatched Route" in place of Home after an
  // otherwise-successful sign-in. iOS needs the exact Google-registered redirect regardless of
  // that classification, so it's used directly rather than depending on the check.
  const redirectUri = useMemo(
    () => (Platform.OS === "web" ? makeRedirectUri() : nativeRedirectUri(clientId)),
    [clientId],
  );

  const [request, , promptAsync] = useAuthRequest(
    {
      clientId,
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: ResponseType.Code,
      // Required by Google for installed apps, and the reason no client secret appears here.
      // expo-auth-session generates the verifier/challenge pair and exposes the verifier on
      // `request` for the exchange below.
      usePKCE: true,
      prompt: Prompt.SelectAccount,
    },
    GOOGLE_DISCOVERY,
  );

  const signInWithBrowserRedirect = useCallback(async (): Promise<string | null> => {
    if (!clientId) {
      throw new Error("Google client ID is not configured — set EXPO_PUBLIC_GOOGLE_*_CLIENT_ID in apps/mobile/.env");
    }

    const result = await promptAsync();
    if (result.type !== "success" || !result.params.code) return null;

    // Second leg: trade the one-time code for tokens. The code_verifier proves this is the same
    // app that made the authorization request — without it Google rejects the exchange.
    const tokens = await exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri,
        extraParams: request?.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      },
      GOOGLE_DISCOVERY,
    );

    return tokens.idToken ?? null;
  }, [promptAsync, clientId, redirectUri, request]);

  const signInWithNativeModule = useCallback(async (): Promise<string | null> => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      throw new Error("Google web client ID is not configured — set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in apps/mobile/.env");
    }
    configureAndroidGoogleSignInOnce();

    // Play Services being missing/outdated is routine on real Android devices (not every device
    // ships it, and it updates independently of the OS) — this prompts the user to install/update
    // it rather than letting signIn() below fail with an opaque native error.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // SignInParams has no "always show the chooser" flag — Play Services' silent-sign-in isn't
    // configurable that way. signOut() first is the documented mechanism instead: it clears the
    // cached account Play Services would otherwise reuse without prompting, so the next signIn()
    // call is forced to show the picker again — matching iOS's Prompt.SelectAccount on the
    // browser-redirect branch above, which forces the same thing there. Safe to call
    // unconditionally: Play Services no-ops it when nothing is currently signed in, and a caught
    // failure here should never block the sign-in attempt that follows — at worst this one call
    // silently reuses the cached account instead of forcing a fresh choice.
    await GoogleSignin.signOut().catch(() => undefined);

    const result = await GoogleSignin.signIn();
    // isSuccessResponse narrows away the "user cancelled" branch, which carries no `data` at all
    // — the same "cancelled, not an error" outcome the browser-redirect branch returns null for.
    if (!isSuccessResponse(result)) return null;

    return result.data.idToken;
  }, []);

  return Platform.OS === "android" ? signInWithNativeModule : signInWithBrowserRedirect;
}
