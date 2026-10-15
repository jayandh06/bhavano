import { useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { BoostOfferMessageCardDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { appWebUrl } from "../../lib/appWebUrl";
import { Icon } from "../Icon";
import { BoostBundleCard } from "./BoostBundleCard";
import { IosBoostSheet } from "./IosPurchaseSheets";

/** The "Bhavano Admin" Boost message drawn as a card — mirrors web's BoostOfferMessageCard.tsx.
 *
 * The button follows BoostButton's iOS/Android split: iOS opens the App Store purchase sheet
 * (Apple Guideline 3.1.1, see docs/plans/ios-in-app-purchase.md); Android opens the same
 * promo-priced picker the post-ad screen uses, passing the source itself.
 *
 * On iOS the card's headline, offer note and paragraphs are NOT shown: they come from the server
 * and quote web prices and web promotions ("Boost it for 7 days for ₹99", "50% off"), which do not
 * apply to an App Store purchase and would advertise a price the buyer cannot get there. */
export function BoostOfferMessageCard({
  card,
  accessToken,
}: {
  card: BoostOfferMessageCardDto;
  accessToken: string | null;
}) {
  const { colors } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  const ios = Platform.OS === "ios";

  function onBoost() {
    if (ios || (Platform.OS === "android" && accessToken)) setPickerOpen(true);
    else void WebBrowser.openBrowserAsync(appWebUrl(card.ctaPath));
  }

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceAlt }]}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={[styles.thumb, { backgroundColor: colors.border }]} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.border }]}>
            <Icon name="home" size={24} color={colors.muted} />
          </View>
        )}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, color: colors.muted }}>YOUR AD</Text>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
            {card.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Icon name="pin" size={11} color={colors.textSoft} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textSoft }}>
              {card.location}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 14, paddingTop: 12 }}>
        <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 17, color: colors.text }}>
          {ios ? "Feature this ad" : card.headline}
        </Text>
        {!ios && card.offerNote && (
          <Text
            style={[styles.offer, { backgroundColor: `${colors.gold}33`, color: colors.text }]}
          >
            {card.offerNote}
          </Text>
        )}
        {(ios
          ? ["Show your ad higher in search for more views. Instant Alerts are included while it is featured."]
          : card.paragraphs
        ).map((paragraph) => (
          <Text key={paragraph} style={{ marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.textSoft }}>
            {paragraph}
          </Text>
        ))}
        {activating ? (
          <Text style={{ marginTop: 14, textAlign: "center", fontWeight: "700", color: colors.green }}>
            Featuring…
          </Text>
        ) : (
          <Pressable onPress={onBoost} style={[styles.button, { backgroundColor: colors.green }]}>
            <Icon name="boost" size={15} color={colors.onGreen} />
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{card.ctaLabel}</Text>
          </Pressable>
        )}
      </View>

      {ios && (
        <IosBoostSheet
          visible={pickerOpen}
          listingId={card.listingId}
          category={card.category}
          onClose={() => setPickerOpen(false)}
          onPurchased={() => setActivating(true)}
        />
      )}
      {Platform.OS === "android" && accessToken && (
        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
              <BoostBundleCard
                listingId={card.listingId}
                category={card.category}
                accessToken={accessToken}
                source="admin_boost_message"
                ignorePlacementSetting
                onActivating={() => {
                  setPickerOpen(false);
                  setActivating(true);
                }}
              />
              <Pressable onPress={() => setPickerOpen(false)} style={{ alignSelf: "center", marginTop: 12 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: "flex-start", width: "88%", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: { flexDirection: "row", gap: 12, padding: 14, paddingBottom: 12 },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  offer: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  button: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 11,
  },
  scrim: { flex: 1, backgroundColor: "#00000088", alignItems: "center", justifyContent: "center", padding: 20 },
});
