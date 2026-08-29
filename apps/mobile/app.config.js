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
    // "bhavano" is the app's own deep-link scheme. The second entry is the reversed form of the
    // iOS Google OAuth client ID: Google redirects there after sign-in, and iOS only hands the
    // callback to this app if the scheme is declared here. It is a public identifier, not a
    // secret — it ships inside every iOS app that uses Google sign-in. Changing the OAuth client
    // means changing this string and rebuilding, since it lands in Info.plist at build time.
    scheme: ["bhavano", "com.googleusercontent.apps.336986668125-vs9rfncotlefvtc9e7rsl15r5lhmjfht"],
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
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
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
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
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
    ],
    extra: {
      router: {},
      eas: {
        projectId: "1d49dddb-076f-426a-a702-4ebfedaed527",
      },
    },
  },
};
