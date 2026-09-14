import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { ListingCategory } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { BoostModal } from "./BoostModal";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

/** "Boost Ad" trigger — mirrors web's BoostButton.tsx (outline pill, same copy). Owns the same
 * iOS/Android split PostAdWizard's own success-screen boost button does: a Razorpay-paid boost is
 * exactly the "digital promotion of a listing" Apple's Guideline 3.1.1 targets, so iOS opens the
 * website instead of the native checkout — see docs/plans/ios-app-store-release.md's "In-app
 * purchases" note. Not shared with PostAdWizard's own button (that one sits inside a differently
 * styled celebration card, not a plain pill) — if this branch ever needs to change, check both. */
export function BoostButton({
  listingId,
  category,
  accessToken,
}: {
  listingId: string;
  category: ListingCategory;
  accessToken: string;
}) {
  const { colors } = useAppTheme();
  const [boostOpen, setBoostOpen] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);

  if (pendingActivation) {
    return (
      <Text style={[styles.pending, { color: colors.green }]}>
        <Icon name="boost" size={13} color={colors.green} /> Boost pending…
      </Text>
    );
  }

  return (
    <>
      <Pressable
        onPress={() =>
          Platform.OS === "ios" ? WebBrowser.openBrowserAsync(`${SITE_URL}/my-listings`) : setBoostOpen(true)
        }
        style={[styles.button, { borderColor: colors.green }]}
      >
        <Icon name="boost" size={13} color={colors.green} />
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Boost Ad</Text>
      </Pressable>
      {Platform.OS === "android" && (
        <BoostModal
          visible={boostOpen}
          listingId={listingId}
          category={category}
          accessToken={accessToken}
          onClose={() => setBoostOpen(false)}
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
