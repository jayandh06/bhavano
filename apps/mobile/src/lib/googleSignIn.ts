import { useCallback, useMemo } from "react";
import * as WebBrowser from "expo-web-browser";
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest, ResponseType, Prompt } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/** Turns "1234-abc.apps.googleusercontent.com" into "com.googleusercontent.apps.1234-abc" — the
 * reversed-DNS URL scheme Google registers for native OAuth clients, and the only redirect they
 * will accept from an iOS/Android app. The scheme is also declared in app.config.js, without which
 * iOS has no way to route the callback back into the app. */
function nativeRedirectUri(clientId: string): string {
  const scheme = clientId.split(".").reverse().join(".");
  return `${scheme}:/oauthredirect`;
}

/**
 * Google sign-in via the generic AuthSession flow (the dedicated expo-auth-session Google provider
 * is deprecated in SDK 57 in favour of @react-native-google-signin/google-signin, which needs its
 * own native module). Returns an `id_token` for the BFF's POST /auth/google, or null if the user
 * cancelled.
 *
 * **Authorization code + PKCE, not implicit.** Google supports only `response_type=code` for
 * installed apps — `id_token` implicit responses are rejected outright with
 * "Error 400: invalid_request / Bhavano's request is invalid", no matter what other parameters are
 * sent. See https://developers.google.com/identity/protocols/oauth2/native-app. That costs a second
 * round trip (exchangeCodeAsync below) because the id_token arrives from the token endpoint rather
 * than the redirect, but it is the only shape Google accepts here.
 *
 * No client secret is used or needed: native clients are public, and PKCE — not a secret — is what
 * proves the app exchanging the code is the one that requested it.
 */
export function useGoogleSignIn() {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    "";

  // Built once and reused for both legs: Google requires the redirect_uri sent to the token
  // endpoint to be byte-identical to the one on the authorization request, or the exchange fails.
  const redirectUri = useMemo(() => makeRedirectUri({ native: nativeRedirectUri(clientId) }), [clientId]);

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

  return useCallback(async (): Promise<string | null> => {
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
}
