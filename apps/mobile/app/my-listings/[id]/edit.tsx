import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible } from "@bhavano/types/categoryFields";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import { areaUnitShortLabel, type AreaUnit } from "@bhavano/types/areaUnit";
import { clampPrice, maxPriceFor, TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { MAX_PHOTOS } from "@bhavano/types/photoLimits";
import { POST_CATEGORIES } from "@bhavano/types/postCategories";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { useMyListingQuery } from "../../../src/lib/queries";
import { addListingPhoto, addListingVideo, deleteListingPhoto, deleteListingVideo, updateListing } from "../../../src/lib/bffClient";
import { Icon } from "../../../src/components/Icon";
import { ScreenHeader } from "../../../src/components/home/ScreenHeader";
import { CategoryFieldsForm } from "../../../src/components/home/CategoryFieldsForm";

const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska"];

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: "active", label: "Active — visible to buyers/renters" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "deactivated", label: "Deactivated — hidden from search" },
];

/** Same shape EditListingForm.tsx keeps on the web — the attributes column is JSONB
 * (Record<string, unknown> on the wire), so a legacy number/boolean needs coercing to the
 * string/string[] the field controls actually edit. */
function attributesToStrings(attributes: Record<string, unknown>): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(attributes)) {
    result[key] = Array.isArray(value) ? value.map(String) : value === null || value === undefined ? "" : String(value);
  }
  return result;
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken } = useHomeSheets();
  const { data, isLoading, error } = useMyListingQuery(id, accessToken);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Edit listing" onBack={() => router.back()} />
      {isLoading || !accessToken ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : error || !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
            Couldn&rsquo;t load this listing — it may not be yours, or it may no longer exist.
          </Text>
        </View>
      ) : (
        <EditListingFormBody listing={data} accessToken={accessToken} />
      )}
    </View>
  );
}

function EditListingFormBody({ listing: initialListing, accessToken }: { listing: ListingDetailDto; accessToken: string }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  // Photos/videos live on `listing` and are refreshed straight from each mutation's own response
  // (every photo/video endpoint returns the full updated ListingDetailDto) — title/price/etc.
  // below are held separately and only sent on "Save changes", same split web's EditListingForm +
  // EditListingPhotos/VideoManager draw between the two.
  const [listing, setListing] = useState(initialListing);
  const [title, setTitle] = useState(initialListing.title);
  const [description, setDescription] = useState(initialListing.description ?? "");
  const [price, setPrice] = useState(String(initialListing.price).replace(/[^0-9]/g, ""));
  const [priceQualifier, setPriceQualifier] = useState(initialListing.priceQualifier);
  // "Whole price vs price per unit" — see web EditListingForm.tsx's identical toggle. Category/
  // transactionType are fixed in this screen (owner editing can't change them), so no
  // reset-on-change is needed here.
  const [priceMode, setPriceMode] = useState<"total" | "perUnit">(initialListing.priceUnit ? "perUnit" : "total");
  const [attributes, setAttributes] = useState<Record<string, string | string[]>>(
    attributesToStrings(initialListing.attributes),
  );
  const [status, setStatus] = useState<ListingStatus>(initialListing.status);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [deletingPhotoNo, setDeletingPhotoNo] = useState<number | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const fieldConfig = CATEGORY_FIELD_CONFIG[listing.category];
  const visibleFields = fieldConfig.filter((field) => fieldIsVisible(field, listing.transactionType, attributes));
  const priceUnitAreaField =
    listing.transactionType === "sell" || listing.transactionType === "lease"
      ? fieldConfig.find((field) => field.type === "area")
      : undefined;
  const currentAreaUnit = (attributes[`${priceUnitAreaField?.key}Unit`] as AreaUnit | undefined) ?? "sqft";
  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  const requiredAttributesFilled = visibleFields.every((field) => {
    if (!field.required) return true;
    const value = attributes[field.key];
    return Array.isArray(value) ? value.length > 0 : (value ?? "").length > 0;
  });
  const priceOnRequestAllowed = PRICE_ON_REQUEST_CATEGORIES.has(listing.category);
  const valid = (priceValue > 0 || priceOnRequestAllowed) && title.trim().length > 0 && requiredAttributesFilled;

  const priceQualifierOptions = getPriceQualifierOptions(listing.category, listing.transactionType);
  const priceQualifierChoices = priceQualifierOptions.some((opt) => opt.value === priceQualifier)
    ? priceQualifierOptions
    : [
        { value: priceQualifier, label: priceQualifier ? `"${priceQualifier}" (current)` : "(none)" },
        ...priceQualifierOptions,
      ];

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateListing(accessToken, listing.id, {
        title: title.trim(),
        price: priceValue,
        priceQualifier,
        priceUnit: priceMode === "perUnit" && priceUnitAreaField ? currentAreaUnit : null,
        description: description.trim(),
        attributes,
        status,
      });
      setListing(updated);
      setMessage({ type: "success", text: "Listing updated." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update listing" });
    } finally {
      setSaving(false);
    }
  }

  async function pickAndAddPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const room = MAX_PHOTOS - listing.photosFull.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: room,
    });
    if (result.canceled) return;

    setMediaError(null);
    setPhotoUploading(true);
    for (const asset of result.assets) {
      if (asset.mimeType && !ALLOWED_PHOTO_MIME_TYPES.includes(asset.mimeType)) {
        setMediaError("One of the selected photos isn't a supported format — use JPEG, PNG, WebP, or GIF.");
        continue;
      }
      try {
        const updated = await addListingPhoto(asset.uri, listing.id, accessToken);
        setListing(updated);
      } catch (e) {
        setMediaError(e instanceof Error ? e.message : "Failed to add photo");
      }
    }
    setPhotoUploading(false);
  }

  async function onDeletePhoto(photoNo: number) {
    setDeletingPhotoNo(photoNo);
    setMediaError(null);
    try {
      const updated = await deleteListingPhoto(accessToken, listing.id, photoNo);
      setListing(updated);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Failed to delete photo");
    } finally {
      setDeletingPhotoNo(null);
    }
  }

  async function pickAndAddVideo() {
    if (!listing.videoEntitlement || listing.videos.length >= listing.videoEntitlement.maxVideos) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (asset.mimeType && !ALLOWED_VIDEO_MIME_TYPES.includes(asset.mimeType)) {
      setMediaError(`"${asset.fileName ?? "That video"}" isn't a supported format.`);
      return;
    }

    setMediaError(null);
    setVideoUploading(true);
    try {
      const updated = await addListingVideo(asset.uri, listing.id, accessToken);
      setListing(updated);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Failed to add video");
    } finally {
      setVideoUploading(false);
    }
  }

  async function onDeleteVideo(videoId: string) {
    setDeletingVideoId(videoId);
    setMediaError(null);
    try {
      const updated = await deleteListingVideo(accessToken, listing.id, videoId);
      setListing(updated);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Failed to delete video");
    } finally {
      setDeletingVideoId(null);
    }
  }

  // react-native-keyboard-controller's KeyboardAvoidingView, not RN's own — see
  // ProfileFields'/ConversationThread's identical comment for why "padding" is now unconditional
  // rather than iOS-only.
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      // Same reasoning as PostAdWizard/ProfileFields: a long form with conditionally-nested
      // fields, where KeyboardAvoidingView's padding alone did not reliably scroll a
      // newly-focused one into view.
      automaticallyAdjustKeyboardInsets
    >
      <Text style={[styles.label, { color: colors.textSoft }]}>Category / transaction</Text>
      <View style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ color: colors.textSoft, fontSize: 14 }}>
          {POST_CATEGORIES.find((c) => c.value === listing.category)?.label} · {listing.transactionType}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={[styles.label, { color: colors.textSoft }]}>Title</Text>
        <Text
          style={{
            fontSize: 12,
            color:
              title.length >= TITLE_MAX_LENGTH ? "#b3413a" : title.length > TITLE_MAX_LENGTH - 20 ? colors.green : colors.muted,
          }}
        >
          {title.length}/{TITLE_MAX_LENGTH}
        </Text>
      </View>
      <TextInput
        value={title}
        maxLength={TITLE_MAX_LENGTH}
        onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX_LENGTH))}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.textSoft }]}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        placeholder="Describe the place in your own words — the layout, the neighbourhood, what's nearby."
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />

      {priceUnitAreaField && (
        <View style={[styles.chipRow, { marginTop: 0 }]}>
          <Pressable
            onPress={() => setPriceMode("total")}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: priceMode === "total" ? colors.surfaceAlt : "transparent" }]}
          >
            <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>Total price</Text>
          </Pressable>
          <Pressable
            onPress={() => setPriceMode("perUnit")}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: priceMode === "perUnit" ? colors.surfaceAlt : "transparent" }]}
          >
            <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>Price per {areaUnitShortLabel(currentAreaUnit, 1)}</Text>
          </Pressable>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textSoft }]}>
            {priceMode === "perUnit" ? `Price per ${areaUnitShortLabel(currentAreaUnit, 1)} (₹) *` : "Price (₹) *"}
          </Text>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(clampPrice(v, listing.transactionType))}
            keyboardType="number-pad"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textSoft }]}>Price qualifier</Text>
          <View style={[styles.chipRow, { marginTop: 0 }]}>
            {priceQualifierChoices.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPriceQualifier(opt.value)}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: priceQualifier === opt.value ? colors.surfaceAlt : "transparent" }]}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      {price.length > 0 && priceValue <= 0 && !priceOnRequestAllowed && (
        <Text style={styles.fieldError}>Enter a price greater than 0.</Text>
      )}
      {priceValue > maxPriceFor(listing.transactionType) && (
        <Text style={styles.fieldError}>That&rsquo;s above the allowed maximum.</Text>
      )}

      <View style={[styles.divider, { borderColor: colors.border, marginTop: 18 }]}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
          {POST_CATEGORIES.find((c) => c.value === listing.category)?.label} details
        </Text>
        <CategoryFieldsForm
          category={listing.category}
          transactionType={listing.transactionType}
          attributes={attributes}
          onAttributesChange={setAttributes}
        />
      </View>

      <Text style={[styles.label, { color: colors.textSoft, marginTop: 18 }]}>Photos (up to {MAX_PHOTOS})</Text>
      {listing.photosFull.length < MAX_PHOTOS && (
        <Pressable
          onPress={pickAndAddPhotos}
          disabled={photoUploading}
          style={[styles.photoButton, { borderColor: colors.green, backgroundColor: colors.surfaceAlt, opacity: photoUploading ? 0.6 : 1 }]}
        >
          <Icon name="camera" size={22} color={colors.green} />
          <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>
            {photoUploading ? "Uploading…" : listing.photosFull.length > 0 ? "Add more photos" : "Add photos"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{MAX_PHOTOS - listing.photosFull.length} more allowed</Text>
        </Pressable>
      )}
      {listing.photosFull.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          {listing.photosFull.map((url, i) => {
            const photoNo = listing.photoNos[i];
            const deleting = deletingPhotoNo === photoNo;
            return (
              <View key={photoNo}>
                <Image source={{ uri: `${url}?t=${listing.photoUpdatedAts[i]}` }} style={[styles.photoThumb, { opacity: deleting ? 0.5 : 1 }]} />
                {i === 0 && (
                  <View style={[styles.coverBadge, { backgroundColor: colors.green }]}>
                    <Text style={{ color: colors.onGreen, fontSize: 9, fontWeight: "700" }}>Cover</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => onDeletePhoto(photoNo)}
                  disabled={deleting}
                  style={[styles.removeBadge, { backgroundColor: colors.surface }]}
                >
                  <Icon name="close" size={13} color="#c0554b" />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {listing.videoEntitlement && (
        <>
          <Text style={[styles.label, { color: colors.textSoft, marginTop: 18 }]}>
            Videos (optional, up to {listing.videoEntitlement.maxVideos})
          </Text>
          {listing.videos.length < listing.videoEntitlement.maxVideos ? (
            <Pressable
              onPress={pickAndAddVideo}
              disabled={videoUploading}
              style={[styles.photoButton, { borderColor: colors.green, backgroundColor: colors.surfaceAlt, opacity: videoUploading ? 0.6 : 1 }]}
            >
              <Icon name="video" size={22} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>
                {videoUploading ? "Uploading…" : listing.videos.length > 0 ? "Add another video" : "Add a video"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>up to {listing.videoEntitlement.maxDurationSec}s</Text>
            </Pressable>
          ) : (
            listing.videoEntitlement.canUpgradeByBoosting && (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Boost this listing to add up to 3 videos, up to 2 minutes each.</Text>
            )
          )}
          {listing.videos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {listing.videos.map((video) => {
                const deleting = deletingVideoId === video.id;
                return (
                  <View key={video.id}>
                    <View style={[styles.videoThumb, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, opacity: deleting ? 0.5 : 1 }]}>
                      <Icon name="video" size={20} color={colors.textSoft} />
                      <Text style={{ color: colors.textSoft, fontSize: 10.5, fontWeight: "700", marginTop: 4, textAlign: "center" }}>
                        {video.status === "done" ? `${Math.round(video.durationSec)}s` : video.status === "failed" ? "Failed" : "Processing…"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onDeleteVideo(video.id)}
                      disabled={deleting}
                      style={[styles.removeBadge, { backgroundColor: colors.surface }]}
                    >
                      <Icon name="close" size={13} color="#c0554b" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
      {mediaError && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{mediaError}</Text>}

      <Text style={[styles.label, { color: colors.textSoft, marginTop: 18 }]}>Status</Text>
      <Pressable
        onPress={() => setStatusPickerOpen((open) => !open)}
        style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
          {STATUS_OPTIONS.find((o) => o.value === status)?.label}
        </Text>
        <Icon name="chevronDown" size={13} color={colors.muted} />
      </Pressable>
      {statusPickerOpen && (
        <View style={{ gap: 8, marginBottom: 8 }}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                setStatus(opt.value);
                setStatusPickerOpen(false);
              }}
              style={[
                styles.statusOption,
                { borderColor: status === opt.value ? colors.green : colors.border, backgroundColor: status === opt.value ? colors.surfaceAlt : colors.surface },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 13.5 }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {message && (
        <Text style={{ color: message.type === "success" ? colors.green : "#c0554b", fontSize: 13, marginTop: 12 }}>
          {message.text}
        </Text>
      )}

      <Pressable
        onPress={onSave}
        disabled={saving || !valid}
        style={[styles.saveButton, { backgroundColor: colors.green, opacity: saving || !valid ? 0.5 : 1 }]}
      >
        {saving ? <ActivityIndicator color={colors.onGreen} /> : <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Save changes</Text>}
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 4 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  readOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  fieldError: { color: "#c0554b", fontSize: 12, marginTop: 4 },
  divider: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  photoButton: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 18, alignItems: "center", gap: 6 },
  photoThumb: { width: 90, height: 90, borderRadius: 8 },
  videoThumb: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  coverBadge: { position: "absolute", top: 6, left: 6, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5 },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  statusOption: { borderWidth: 1.5, borderRadius: 10, padding: 12 },
  saveButton: { borderRadius: 9, paddingVertical: 14, alignItems: "center", marginTop: 20 },
});
