import { Redirect } from "expo-router";

/**
 * Not a real screen — a landing pad for Google's OAuth redirect. The Google sign-in flow
 * (src/lib/googleSignIn.ts) uses `com.googleusercontent.apps.<id>:/oauthredirect` as its native
 * redirect URI, the only shape Google accepts for a native OAuth client — declared as a `scheme`
 * in app.config.js alongside this app's own "bhavano" scheme, so both open the app.
 * `WebBrowser.maybeCompleteAuthSession()` intercepts that URL and resolves the sign-in promise —
 * which is why login itself succeeds — but the OS "app opened via this URL" event *also* reaches
 * Expo Router's own deep-link handling independently, as a separate listener that resolves the
 * path portion against `app/` regardless of which of the two declared schemes triggered it.
 * Without a matching route, Router showed "Unmatched Route" in place of Home after a successful
 * Google login (first seen while a separate bug had the redirect on the wrong scheme entirely —
 * see googleSignIn.ts's redirectUri comment — but this route is needed either way, since it's
 * Router's independent listener causing it, not which scheme). This file exists purely so that
 * path resolves to something real, which immediately bounces to Home rather than stranding the
 * user here.
 */
export default function OAuthRedirectScreen() {
  return <Redirect href="/" />;
}
