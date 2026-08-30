import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ListingCardDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { createConversation, toggleFavourite } from "../../lib/bffClient";

export function ListingCard({ item, cityName }: { item: ListingCardDto; cityName: string }) {
  const { colors } = useAppTheme();
  const { requireLogin, accessToken } = useHomeSheets();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [contactError, setContactError] = useState<string | null>(null);

  // TEMP(auth-gate): viewing listing details is open without login for now.
  const openDetail = () => router.push(`/listing/${item.id}`);

  async function onToggleFavourite() {
    if (!accessToken) {
      requireLogin();
      return;
    }
    const result = await toggleFavourite(accessToken, item.id);
    setIsFavourited(result.favourited);
    setLikeCount(result.likeCount);
  }

  // Opens the conversation with the seller — the same thing the detail screen's button does.
  // It prompts for login only when there is no token, rather than unconditionally, which is what
  // made this button show the login sheet to users who were already signed in.
  async function onContactOwner() {
    if (!accessToken) {
      requireLogin();
      return;
    }
    setContactError(null);
    try {
      const conversation = await createConversation(accessToken, item.id);
      router.push(`/messages/${conversation.id}`);
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Failed to start conversation");
    }
  }

  return (
    <Pressable onPress={openDetail} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View
        style={[
          styles.imageArea,
          { backgroundColor: item.imgColors[0] },
        ]}
      >
        <View style={[styles.imageOverlayA, { backgroundColor: item.imgColors[1] }]} />
        {item.photos[0] ? (
          <Image source={{ uri: item.photos[0] }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={styles.imageCaption}>{item.imgLabel}</Text>
        )}
        <View style={[styles.tag, { backgroundColor: colors.green }]}>
          <Text style={{ color: colors.onGreen, fontSize: 10, fontWeight: "700" }}>{item.tag}</Text>
        </View>
        <Pressable onPress={onToggleFavourite} style={styles.heartButton}>
          <Text style={{ fontSize: 13, color: isFavourited ? "#c0554b" : "#000" }}>{isFavourited ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.green }}>{item.price}</Text>
          {!!item.priceQualifier && (
            <View style={[styles.qualifierChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.muted }}>{item.priceQualifier}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{item.title}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          📍 {item.area}, {cityName}
        </Text>
        <View style={styles.specsRow}>
          {item.specs.map((spec) => (
            <Text key={spec} style={{ fontSize: 11.5, fontWeight: "600", color: colors.textSoft }}>
              {spec}
            </Text>
          ))}
        </View>
        <View style={styles.specsRow}>
          <Text style={{ fontSize: 11, color: colors.muted }}>👁 {item.viewCount}</Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>♥ {likeCount}</Text>
        </View>
        <View style={styles.actionsRow}>
          <Pressable onPress={onContactOwner} style={[styles.contactButton, { backgroundColor: colors.green }]}>
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>Contact owner</Text>
          </Pressable>
        </View>
        {contactError ? (
          <Text style={{ color: "#c0554b", fontSize: 12, marginTop: 6 }}>{contactError}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  // aspectRatio (not a fixed height) so the image scales proportionally at whatever card width
  // results from the grid's column count — a hardcoded height would look squashed at the
  // narrower width a 2-column (tablet) card ends up with (see mobile-filters-and-sort.md).
  imageArea: { aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  imageOverlayA: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 },
  imageCaption: {
    fontSize: 10,
    color: "#ffffffcc",
    backgroundColor: "#00000030",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  tag: { position: "absolute", top: 10, left: 10, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  heartButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffffee",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 14, gap: 8 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  qualifierChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  specsRow: { flexDirection: "row", gap: 10 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  contactButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
});
