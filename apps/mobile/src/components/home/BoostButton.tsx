import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import type { ListingCategory } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { BoostModal } from "./BoostModal";
import { IosBoostSheet } from "./IosPurchaseSheets";

/** "Boost Ad" trigger — mirrors web's BoostButton.tsx (outline pill, same copy). Owns the same
 * iOS/Android split PostAdWizard's own success-screen boost button does: a boost is exactly the
 * "digital promotion of a listing" Apple's Guideline 3.1.1 targets, so iOS sells it through the
 * App Store (IosBoostSheet) while Android keeps the Razorpay checkout. An iOS boost is fulfilled
 * as soon as the server has verified the purchase, with no webhook to wait for. See
 * docs/plans/ios-in-app-purchase.md. Not shared with PostAdWizard's own button (that one sits
 * inside a differently styled celebration card, not a plain pill) — if this branch ever needs to
 * change, check both. */
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
  const [featured, setFeatured] = useState(false);

  if (pendingActivation) {
    return (
      <Text style={[styles.pending, { color: colors.green }]}>
        <Icon name="boost" size={13} color={colors.green} /> Featuring…
      </Text>
    );
  }

  if (featured) {
    return (
      <Text style={[styles.pending, { color: colors.green }]}>
        <Icon name="boost" size={13} color={colors.green} /> Featured
      </Text>
    );
  }

  return (
    <>
      <Pressable onPress={() => setBoostOpen(true)} style={[styles.button, { borderColor: colors.green }]}>
        <Icon name="boost" size={13} color={colors.green} />
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Feature Ad</Text>
      </Pressable>
      {Platform.OS === "ios" && (
        <IosBoostSheet
          visible={boostOpen}
          listingId={listingId}
          category={category}
          onClose={() => setBoostOpen(false)}
          onPurchased={() => setFeatured(true)}
        />
      )}
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
