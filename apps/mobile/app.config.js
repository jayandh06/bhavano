// Was a static app.json — converted to app.config.js so the react-native-maps plugin below can
// read EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY from .env at config-evaluation time (a static JSON
// file can't reference process.env at all). See docs/plans/google-maps-location-picker.md.
module.exports = {
  expo: {
    // Display name under the app icon and in the store listing. The publisher/developer name in
    // the Play and App Store consoles must read "Finfolia Technologies LLP" to match — that's a
    // console setting, not config. See docs/plans/finfolia-entity-disclosure.md.
    name: "Bhavano",
    // Must match the slug of the EAS project named by extra.eas.projectId below, or eas-cli
    // refuses to build. The EAS project is "bhavano" under the finfolia-technologies-llp account.
    slug: "bhavano",
    owner: "finfolia-technologies-llp",
    // "bhavano" is the app's own deep-link scheme. The other two are the reversed form of the
    // iOS and Android Google OAuth client IDs: Google redirects there after sign-in, and iOS/
    // Android only hand the callback to this app if its own scheme is declared here — an app
    // built with only the iOS one present (as this briefly was) has nowhere to route the Android
    // client's callback at all, regardless of what the JS side sends as the request's client_id.
    // Public identifiers, not secrets — they ship inside every app that uses Google sign-in.
    // Changing either OAuth client means changing its string here and rebuilding, since both land
    // in native config (Info.plist / AndroidManifest.xml) at build time.
    scheme: [
      "bhavano",
      "com.googleusercontent.apps.336986668125-vs9rfncotlefvtc9e7rsl15r5lhmjfht",
      "com.googleusercontent.apps.336986668125-gujm24as4oq0lqktsn8it63hgg2pm9hi",
    ],
    version: "1.0.0",
    // EAS Update, added by `eas update:configure` (which can only print these for a dynamic
    // config, not write them). The "appVersion" policy ties an update to the `version` above, so
    // a binary only accepts updates built against the same 1.0.0 — bumping version cuts older
    // builds off, which is what you want when a release contains native changes.
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/1d49dddb-076f-426a-a702-4ebfedaed527",
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    ios: {
      // iPad support means App Review checks iPad layouts and the listing needs iPad
      // screenshots. Nothing here has been tested at that size, and shipping a broken tablet
      // layout is an easy rejection — turn this back on deliberately, with screenshots.
      supportsTablet: false,
      bundleIdentifier: "com.finfolia.bhavano",
      // Sign in with Apple (Guideline 4.8) — see HomeSheetsProvider.tsx's login sheet and
      // docs/plans/ios-app-store-release.md.
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // react-native-razorpay's UPI intent flow (pay via a UPI app instead of entering card
        // details) checks whether these apps are installed before offering them — without
        // declaring the schemes here, iOS silently reports every one of them as "not
        // installed" even when they are, and UPI drops out of the payment options entirely.
        LSApplicationQueriesSchemes: ["tez", "phonepe", "paytmmp"],
        // App Tracking Transparency (see src/lib/trackingConsent.ts) — required because the
        // backend reports signup/post-ad conversions to Google Ads using hashed email/phone,
        // which is "tracking" under Apple's definition even without an IDFA. Shown to the user
        // verbatim as the system prompt's explanation.
        NSUserTrackingUsageDescription:
          "Bhavano uses this to measure how well our ads are working, so we can keep posting free for everyone.",
      },
    },
    android: {
      // Without this, the whole window neither pans nor resizes when the keyboard opens, so it
      // simply draws on top of whatever was focused — the login sheet's phone/OTP fields, the
      // filter sheet's price fields, and (with no sheet at all involved) the posting form's price
      // field in its own plain ScrollView. This used to be Android's implicit default, but SDK
      // 57's edge-to-edge broke that. `android_keyboardInputMode="adjustResize"` on the two
      // BottomSheetModals (HomeSheetsProvider's login sheet, FilterSheet) is gorhom's per-sheet
      // half of the same fix — it only takes effect paired with this manifest-level "pan", per
      // https://docs.expo.dev/guides/keyboard-handling/. Native-level (AndroidManifest
      // windowSoftInputMode), so this needs a new Android build, not just a JS reload.
      softwareKeyboardLayoutMode: "pan",
      adaptiveIcon: {
        backgroundColor: "#11523C",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.RECORD_AUDIO",
      ],
      package: "com.finfolia.bhavano",
      // Firebase project's client config — required for Android push: expo-notifications'
      // getExpoPushTokenAsync registers with FCM through it and fails without it. Public client
      // identifiers, safe to commit; the FCM V1 service-account *private key* Expo uses to send
      // is a separate secret, uploaded to EAS Credentials rather than kept in this repo. See
      // docs/plans/unread-message-badge-and-mobile-push.md.
      googleServicesFile: "./google-services.json",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
      "expo-tracking-transparency",
      // Adds the POST_NOTIFICATIONS permission (Android 13+) and sets the small-icon/tint used
      // for the "new message" push. The monochrome icon is the one Android actually renders in
      // the status bar — a full-colour one shows as a white square.
      [
        "expo-notifications",
        {
          icon: "./assets/android-icon-monochrome.png",
          color: "#11523C",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Bhavano uses your location to show ads near you.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Bhavano uses your photos to let you add pictures to your ad.",
        },
      ],
      // Android has no built-in default map provider (unlike iOS's Apple Maps), so this key is
      // required there for the posting flow's location pin-picker. iOS deliberately doesn't set
      // iosGoogleMapsApiKey — it just uses the platform default (Apple Maps) instead, needing no
      // extra credential at all.
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY,
        },
      ],
      // Android-only in practice: Google deprecated custom-URI-scheme OAuth redirects for Android
      // apps ("Error 400: invalid_request — Custom URI scheme is not enabled for your Android
      // client"), which is what googleSignIn.ts's browser-redirect flow depends on — iOS has no
      // such restriction and keeps using that flow untouched. This plugin's native module is what
      // lets Android call Play Services' own account picker directly instead, with no redirect at
      // all. `iosUrlScheme` is mandatory for this plugin regardless of platform (it throws without
      // it) — reusing the iOS client's already-registered scheme from `scheme` above rather than
      // registering a second, functionally-identical one; the plugin's own de-dupe check
      // (IOSConfig.Scheme.hasScheme) is what keeps this a no-op on iOS's Info.plist. Passing this
      // option is also what avoids the alternative "Firebase" mode, which needs a
      // google-services.json this repo has never had any reason to set up.
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.336986668125-vs9rfncotlefvtc9e7rsl15r5lhmjfht",
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: "1d49dddb-076f-426a-a702-4ebfedaed527",
      },
    },
  },
};
