// Was a static app.json — converted to app.config.js so the react-native-maps plugin below can
// read EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY from .env at config-evaluation time (a static JSON
// file can't reference process.env at all). See docs/plans/google-maps-location-picker.md.
module.exports = {
  expo: {
    name: "mobile",
    slug: "mobile",
    scheme: "bhavano",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
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
        projectId: "cf1073e1-7795-4ed3-9ee1-7db540e38a49",
      },
    },
  },
};
