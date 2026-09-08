import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useListingQuery } from "../../src/lib/queries";
import { BffError, createConversation, recordView, revealContact, toggleFavourite } from "../../src/lib/bffClient";
import { Icon } from "../../src/components/Icon";

const VIEWER_KEY_STORAGE = "bhavano.viewerKey";

async function getOrCreateViewerKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(VIEWER_KEY_STORAGE);
  if (existing) return existing;
  const key = Crypto.randomUUID();
  await AsyncStorage.setItem(VIEWER_KEY_STORAGE, key);
  return key;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// TEMP(auth-gate): viewing listing details is open without login for now.
export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { requireLogin, accessToken } = useHomeSheets();
  const router = useRouter();
  const { data: listing, isLoading } = useListingQuery(id, accessToken);
  const [isFavourited, setIsFavourited] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [contactRevealed, setContactRevealed] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [revealPending, setRevealPending] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  useEffect(() => {
    if (listing) {
      setIsFavourited(listing.isFavourited);
      setLikeCount(listing.likeCount);
      setContactRevealed(listing.contactRevealed);
      setOwnerPhone(listing.ownerPhone);
      setOwnerEmail(listing.ownerEmail);
    }
  }, [listing]);

  useEffect(() => {
    if (!id) return;
    getOrCreateViewerKey().then((viewerKey) => recordView(id, viewerKey, accessToken).catch(() => undefined));
    // Only track once per screen mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onToggleFavourite() {
    if (!accessToken) {
      requireLogin();
      return;
    }
    const result = await toggleFavourite(accessToken, id);
    setIsFavourited(result.favourited);
    setLikeCount(result.likeCount);
  }

  async function onMessage() {
    if (!accessToken) {
      requireLogin({ onSuccess: () => void onMessage() });
      return;
    }
    setMessageError(null);
    try {
      const conversation = await createConversation(accessToken, id);
      router.push(`/messages/${conversation.id}`);
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Failed to start conversation");
    }
  }

  /** No in-app purchase flow exists on mobile yet (no native Razorpay integration anywhere in
   * this app) — adding one is a real native-dependency addition needing a fresh EAS build, not
   * something to improvise here. The free-quota/existing-credit-balance path works fully
   * (plain API call); when neither applies, this points the user at buying credits on the web
   * app instead of a native checkout. See docs/plans/contact-reveal-credits.md. */
  async function onViewContact() {
    if (!accessToken) {
      requireLogin({ onSuccess: () => void onViewContact() });
      return;
    }
    setRevealPending(true);
    setRevealError(null);
    setInsufficientCredits(false);
    try {
      const contact = await revealContact(accessToken, id);
      setContactRevealed(true);
      setOwnerPhone(contact.ownerPhone);
      setOwnerEmail(contact.ownerEmail);
    } catch (e) {
      if (e instanceof BffError && e.status === 402) {
        setInsufficientCredits(true);
      } else {
        setRevealError(e instanceof Error ? e.message : "Failed to unlock contact");
      }
    } finally {
      setRevealPending(false);
    }
  }

  if (isLoading || !listing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Icon name="chevronLeft" size={15} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 13 }}>Back</Text>
      </Pressable>

      <View
        style={[
          styles.imageArea,
          { backgroundColor: listing.imgColors[0] },
        ]}
      >
        <View style={[styles.imageOverlay, { backgroundColor: listing.imgColors[1] }]} />
        {listing.photosFull[0] ? (
          <Image source={{ uri: listing.photosFull[0] }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={styles.imageCaption}>{listing.imgLabel}</Text>
        )}
        <View style={[styles.tag, { backgroundColor: colors.green }]}>
          <Text style={{ color: colors.onGreen, fontSize: 11, fontWeight: "700" }}>{listing.tag}</Text>
        </View>
        {listing.isExpired && (
          <View style={[styles.expiredTag]}>
            <Text style={{ color: "#F5F1E6", fontSize: 11, fontWeight: "700" }}>Expired</Text>
          </View>
        )}
      </View>

      <View style={styles.priceRow}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.green }}>{listing.price}</Text>
        {!!listing.priceQualifier && (
          <View style={[styles.qualifierChip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>{listing.priceQualifier}</Text>
          </View>
        )}
      </View>

      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 }}>{listing.title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
        <Icon name="pin" size={12} color={colors.muted} />
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {listing.area}, {listing.cityName}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="eye" size={12} color={colors.muted} />
          <Text style={{ fontSize: 11.5, color: colors.muted }}>{listing.viewCount} views</Text>
        </View>
        <Text style={{ fontSize: 11.5, color: colors.muted }}>
          {listing.isExpired ? "Expired" : `Expires in ${daysUntil(listing.expiresAt)} days`}
        </Text>
      </View>

      {listing.description ? (
        <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSoft, marginTop: 16 }}>
          {listing.description}
        </Text>
      ) : null}

      {/* No chip row. It repeated the labelled details below it — a "3bhk" chip above
          "Bedrooms: 3", in the seller's spelling rather than the app's. The chips are for the
          browse cards, which render none of these sections. */}

      {Object.entries(listing.attributes).length > 0 && (
        <View style={[styles.attributesBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: colors.text, marginBottom: 8 }}>Details</Text>
          {Object.entries(listing.attributes).map(([key, value]) => (
            <Text key={key} style={{ fontSize: 13, color: colors.textSoft, marginBottom: 4 }}>
              <Text style={{ fontWeight: "600", textTransform: "capitalize" }}>{key}</Text>: {String(value)}
            </Text>
          ))}
        </View>
      )}

      {listing.isExpired ? (
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 16 }}>
          This ad has expired and is no longer accepting responses.
        </Text>
      ) : (
        <>
          {/* Message/View Contact are hidden on your own ad — they'd start a conversation with
              yourself or reveal your own number, and offering that reads as the app not knowing
              whose listing it is. Favourite stays: harmless, and the like count is part of the
              page. All three share one compact icon+label style rather than a full-width text
              button, so the row stays legible without crowding the page. */}
          <View style={[styles.actionsRow, { marginTop: 16 }]}>
            <Pressable onPress={onToggleFavourite} style={[styles.actionButton, { borderColor: colors.border }]}>
              <Icon name="heart" size={18} filled={isFavourited} color={isFavourited ? "#c0554b" : colors.text} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted }}>{likeCount}</Text>
            </Pressable>
            {!listing.isOwner && (
              <>
                <Pressable onPress={onMessage} style={[styles.actionButton, { borderColor: colors.border }]}>
                  <Icon name="message" size={18} color={colors.green} />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.green }}>Message</Text>
                </Pressable>
                {!contactRevealed && (
                  <Pressable
                    onPress={onViewContact}
                    disabled={revealPending}
                    style={[styles.actionButton, { borderColor: colors.green, opacity: revealPending ? 0.6 : 1 }]}
                  >
                    <Icon name="phone" size={18} color={colors.green} />
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.green }}>
                      {revealPending ? "Unlocking…" : "View Contact"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
          {messageError && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{messageError}</Text>}
          {revealError && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{revealError}</Text>}
          {insufficientCredits && (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
              You&rsquo;ve used your free reveals. Buy contact-reveal credits at bhavano.com to unlock more.
            </Text>
          )}

          {!listing.isOwner && contactRevealed && (ownerPhone || ownerEmail) && (
            <View style={[styles.contactBox, { borderColor: colors.border }]}>
              {ownerPhone && (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: ownerEmail ? 6 : 0 }}>
                  📞 {ownerPhone}
                </Text>
              )}
              {ownerEmail && (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>✉️ {ownerEmail}</Text>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  imageArea: { height: 220, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  imageOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 },
  imageCaption: {
    fontSize: 12,
    color: "#ffffffcc",
    backgroundColor: "#00000030",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tag: { position: "absolute", top: 12, left: 12, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  expiredTag: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#242420",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  qualifierChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  attributesBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 4 },
  contactBox: { borderWidth: 1.5, borderRadius: 10, padding: 12, marginTop: 8 },
});
