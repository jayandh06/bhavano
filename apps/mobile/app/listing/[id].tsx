import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useListingQuery } from "../../src/lib/queries";
import { createConversation, recordView, toggleFavourite } from "../../src/lib/bffClient";

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

  useEffect(() => {
    if (listing) {
      setIsFavourited(listing.isFavourited);
      setLikeCount(listing.likeCount);
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
      requireLogin();
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

      <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>← Back</Text>
      </Pressable>

      <View
        style={[
          styles.imageArea,
          { backgroundColor: listing.imgColors[0] },
        ]}
      >
        <View style={[styles.imageOverlay, { backgroundColor: listing.imgColors[1] }]} />
        {listing.photos.length === 0 && <Text style={styles.imageCaption}>{listing.imgLabel}</Text>}
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
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
        📍 {listing.area}, {listing.cityName}
      </Text>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
        <Text style={{ fontSize: 11.5, color: colors.muted }}>👁 {listing.viewCount} views</Text>
        <Text style={{ fontSize: 11.5, color: colors.muted }}>
          {listing.isExpired ? "Expired" : `Expires in ${daysUntil(listing.expiresAt)} days`}
        </Text>
      </View>

      <View style={styles.specsRow}>
        {listing.specs.map((spec) => (
          <View key={spec} style={[styles.specChip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSoft }}>{spec}</Text>
          </View>
        ))}
      </View>

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
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 16, marginBottom: 12 }}>
            Ads shown without login — sign in only to respond
          </Text>

          <View style={styles.actionsRow}>
            <Pressable onPress={requireLogin} style={[styles.contactButton, { backgroundColor: colors.green }]}>
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Contact owner</Text>
            </Pressable>
            <Pressable onPress={requireLogin} style={[styles.callButton, { borderColor: colors.green }]}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Call</Text>
            </Pressable>
            <Pressable onPress={onToggleFavourite} style={[styles.heartButton, { borderColor: colors.border }]}>
              <Text style={{ fontSize: 17, color: isFavourited ? "#c0554b" : colors.text }}>
                {isFavourited ? "♥" : "♡"}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted }}>{likeCount}</Text>
            </Pressable>
          </View>
          <Pressable onPress={onMessage} style={[styles.messageButton, { borderColor: colors.green }]}>
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>💬 Message owner</Text>
          </Pressable>
          {messageError && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{messageError}</Text>}
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
  specsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  specChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  attributesBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  actionsRow: { flexDirection: "row", gap: 10 },
  contactButton: { flex: 1, borderRadius: 8, paddingVertical: 13, alignItems: "center" },
  callButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 20, alignItems: "center" },
  heartButton: { width: 52, borderWidth: 1.5, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 2 },
  messageButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 10 },
});
