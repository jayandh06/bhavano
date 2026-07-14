import { useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, useAuthRequest, ResponseType, Prompt } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/**
 * Generic AuthSession OAuth2 flow against Google's discovery endpoint — the dedicated
 * expo-auth-session Google provider is deprecated in SDK 57 in favor of
 * @react-native-google-signin/google-signin, but that requires a custom dev client build.
 * This generic flow still works inside plain Expo Go. Needs a Google OAuth client ID
 * (EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID for Expo Go / EAS proxy, or the iOS/Android client ID
 * once built standalone) registered in Google Cloud Console with this app's redirect URI.
 */
export function useGoogleSignIn() {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    "";

  const [, , promptAsync] = useAuthRequest(
    {
      clientId,
      scopes: ["openid", "profile", "email"],
      redirectUri: makeRedirectUri({ scheme: "bhavano" }),
      responseType: ResponseType.IdToken,
      prompt: Prompt.SelectAccount,
    },
    GOOGLE_DISCOVERY,
  );

  return useCallback(async (): Promise<string | null> => {
    if (!clientId) {
      throw new Error("Google client ID is not configured — set EXPO_PUBLIC_GOOGLE_*_CLIENT_ID in apps/mobile/.env");
    }
    const result = await promptAsync();
    if (result.type === "success" && result.params.id_token) {
      return result.params.id_token;
    }
    return null;
  }, [promptAsync, clientId]);
}
