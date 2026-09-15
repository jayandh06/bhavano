import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { InstantAlertsModal } from "./InstantAlertsModal";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

/** "Get Instant Alerts" trigger — mirrors web's InstantAlertsButton.tsx and this file's own
 * BoostButton.tsx sibling exactly, including the same iOS/Android split: a Razorpay-paid feature
 * unlock is the same "digital promotion of a listing" category Apple's Guideline 3.1.1 targets
 * as boost, so iOS opens the website instead of the native checkout — see
 * docs/plans/ios-app-store-release.md's "In-app purchases" note. `?openInstantAlerts=<id>`
 * deep-links straight into the dialog once there (AutoOpenPurchaseModal.tsx on web), same as
 * BoostButton's `?openBoost`. */
export function InstantAlertsButton({
  listingId,
  accessToken,
}: {
  listingId: string;
  accessToken: string;
}) {
  const { colors } = useAppTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);

  if (pendingActivation) {
    return (
      <Text style={[styles.pending, { color: colors.green }]}>
        <Icon name="bell" size={13} color={colors.green} /> Instant Alerts pending…
      </Text>
    );
  }

  return (
    <>
      <Pressable
        onPress={() =>
          Platform.OS === "ios"
            ? WebBrowser.openBrowserAsync(`${SITE_URL}/my-listings?openInstantAlerts=${listingId}`)
            : setModalOpen(true)
        }
        style={[styles.button, { borderColor: colors.green }]}
      >
        <Icon name="bell" size={13} color={colors.green} />
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Get Instant Alerts</Text>
      </Pressable>
      {Platform.OS === "android" && (
        <InstantAlertsModal
          visible={modalOpen}
          listingId={listingId}
          accessToken={accessToken}
          onClose={() => setModalOpen(false)}
          onActivating={() => setPendingActivation(true)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pending: { fontSize: 12.5, fontWeight: "700" },
});
