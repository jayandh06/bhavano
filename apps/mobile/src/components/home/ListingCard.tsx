import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, Linking } from "react-native";
import { useRouter } from "expo-router";
import type { ListingCardDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { BffError, createConversation, revealContact, toggleFavourite } from "../../lib/bffClient";
import { Icon } from "../Icon";

export function ListingCard({ item }: { item: ListingCardDto }) {
  const { colors } = useAppTheme();
  const { requireLogin, accessToken } = useHomeSheets();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactRevealed, setContactRevealed] = useState(item.contactRevealed);
  const [ownerPhone, setOwnerPhone] = useState(item.ownerPhone);
  const [revealPending, setRevealPending] = useState(false);

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
  // `onSuccess` resumes this same call once login completes, so the user lands straight in the
  // conversation instead of having to tap Message a second time.
  async function onMessage() {
    if (!accessToken) {
      requireLogin({ onSuccess: () => void onMessage() });
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

  // No in-app purchase flow on mobile (see docs/plans/contact-reveal-credits.md) — the
  // free-quota/existing-credit-balance path works fully; when neither applies, this points the
  // user at buying credits on the web app instead of a native checkout.
  async function onViewContact() {
    if (!accessToken) {
      requireLogin({ onSuccess: () => void onViewContact() });
      return;
    }
    setRevealPending(true);
    setContactError(null);
    try {
      const contact = await revealContact(accessToken, item.id);
      setContactRevealed(true);
      setOwnerPhone(contact.ownerPhone);
    } catch (e) {
      if (e instanceof BffError && e.status === 402) {
        setContactError("You've used your free reveals. Buy contact-reveal credits at bhavano.com to unlock more.");
      } else {
        setContactError(e instanceof Error ? e.message : "Failed to unlock contact");
      }
    } finally {
      setRevealPending(false);
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
          <Icon name="heart" size={14} filled={isFavourited} color={isFavourited ? "#c0554b" : "#000"} />
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
        {/* The listing's own city, not the one being browsed. The home screen passed the selected
            city, which is an empty string while browsing all cities — so every card read
            "Koramangala, " with a dangling comma. */}
        <View style={styles.metaRow}>
          <Icon name="pin" size={11} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {item.area}, {item.cityName}
          </Text>
        </View>
        <View style={styles.specsRow}>
          {item.specs.map((spec) => (
            <Text key={spec} style={{ fontSize: 11.5, fontWeight: "600", color: colors.textSoft }}>
              {spec}
            </Text>
          ))}
        </View>
        {/* Counts and the contact actions share one row rather than stacking, matching the web
          * card — the counts sat above full-width buttons before, costing an extra line. Owner's
          * own card still shows the counts here; the buttons just aren't part of the row for it
          * (see ListingDetailView's isOwner gate for the reason). */}
        <View style={styles.actionsRow}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={styles.metaRow}>
              <Icon name="eye" size={12} color={colors.muted} />
              <Text style={{ fontSize: 11, color: colors.muted }}>{item.viewCount}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="heart" size={12} filled color={colors.muted} />
              <Text style={{ fontSize: 11, color: colors.muted }}>{likeCount}</Text>
            </View>
          </View>
          {!item.isOwner && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {/* Light green rather than filled: sharing a row with the counts, a solid button the
                  same weight as before would visually shout over them. */}
              <Pressable onPress={onMessage} style={[styles.contactButton, { backgroundColor: `${colors.green}1a` }]}>
                <Icon name="message" size={12} color={colors.green} />
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12 }}>Message</Text>
              </Pressable>
              {contactRevealed && ownerPhone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${ownerPhone}`)}
                  style={[styles.contactButton, { backgroundColor: colors.green }]}
                >
                  <Icon name="phone" size={12} color={colors.onGreen} />
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 12 }}>{ownerPhone}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={onViewContact}
                  disabled={revealPending}
                  style={[styles.contactButton, { backgroundColor: colors.green, opacity: revealPending ? 0.6 : 1 }]}
                >
                  <Icon name="phone" size={12} color={colors.onGreen} />
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 12 }}>
                    {revealPending ? "Unlocking…" : "Contact"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 },
  contactButton: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
});
