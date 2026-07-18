import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import type { Area, City, ListingCategory, TransactionType } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { useAppTheme } from "../../theme/ThemeContext";
import { createListing, fetchAreas, uploadPhoto } from "../../lib/bffClient";

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const CATEGORIES: { value: ListingCategory; label: string; icon: string }[] = [
  { value: "house", label: "House", icon: "🏡" },
  { value: "apartment", label: "Apartment", icon: "🏢" },
  { value: "pg", label: "PG / Hostel", icon: "🛏️" },
  { value: "storage", label: "Storage space", icon: "📦" },
  { value: "coworking", label: "Coworking", icon: "💼" },
  { value: "furniture", label: "Furniture", icon: "🛋️" },
];

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sell: "Sell",
  buy: "Buy",
  rent: "Rent out",
  lease: "Lease out",
};

type Step = "category" | "transactionType" | "details" | "review";

// TEMP(auth-gate): posting is open without login for now.
export function PostAdWizard({ cities }: { cities: City[] }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [listingId] = useState(() => Crypto.randomUUID());

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  const [title, setTitle] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<Area[]>([]);
  const areaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [specs, setSpecs] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectCategory(next: ListingCategory) {
    setCategory(next);
    setAttributes({});
    const postable = POSTABLE_TRANSACTION_TYPES[next];
    if (postable.length === 1) {
      setTransactionType(postable[0]);
      setPriceQualifier(getPriceQualifierOptions(next, postable[0])[0]?.value ?? "");
      setStep("details");
    } else {
      setTransactionType(null);
      setPriceQualifier("");
      setStep("transactionType");
    }
  }

  function selectTransactionType(next: TransactionType) {
    setTransactionType(next);
    setPriceQualifier(category ? getPriceQualifierOptions(category, next)[0]?.value ?? "" : "");
    setStep("details");
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const room = MAX_PHOTOS - photoUris.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: room,
    });
    if (result.canceled) return;

    const accepted: string[] = [];
    for (const asset of result.assets) {
      if (asset.mimeType && !ALLOWED_PHOTO_MIME_TYPES.includes(asset.mimeType)) {
        setError(`One of the selected photos isn't a supported format — use JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
        setError(`One of the selected photos is over the 4MB limit.`);
        continue;
      }
      accepted.push(asset.uri);
    }
    setPhotoUris((prev) => [...prev, ...accepted]);
  }

  function removePhoto(uri: string) {
    setPhotoUris((prev) => prev.filter((u) => u !== uri));
  }

  function onAreaQueryChange(value: string) {
    setAreaQuery(value);
    setAreaId(null);

    if (areaDebounceRef.current) clearTimeout(areaDebounceRef.current);
    if (!value.trim() || !cityId) {
      setAreaSuggestions([]);
      return;
    }
    areaDebounceRef.current = setTimeout(async () => {
      setAreaSuggestions(await fetchAreas(cityId, value));
    }, 300);
  }

  function onPickArea(a: Area) {
    setAreaQuery(a.name);
    setAreaId(a.id);
    setAreaSuggestions([]);
  }

  function onCityChange(newCityId: string) {
    setCityId(newCityId);
    setAreaQuery("");
    setAreaId(null);
    setAreaSuggestions([]);
  }

  const requiredAttributesFilled = category
    ? CATEGORY_FIELD_CONFIG[category].every((field) => !field.required || (attributes[field.key] ?? "").length > 0)
    : true;

  const detailsValid =
    price.length > 0 &&
    title.length > 0 &&
    areaQuery.trim().length > 0 &&
    !!cityId &&
    photoUris.length > 0 &&
    requiredAttributesFilled;

  async function onSubmit() {
    if (!category || !transactionType) return;
    setPending(true);
    setError(null);
    try {
      const uploadedPhotos: { photoNo: number; hash: string; ext: string }[] = [];
      for (let i = 0; i < photoUris.length; i++) {
        const photoNo = i + 1;
        const upload = await uploadPhoto(photoUris[i], listingId, photoNo);
        uploadedPhotos.push({ photoNo, hash: upload.hash, ext: upload.ext });
      }

      const listing = await createListing({
        id: listingId,
        category,
        transactionType,
        price: Number(price),
        priceQualifier: priceQualifier || undefined,
        title,
        areaId: areaId ?? undefined,
        areaName: areaId ? undefined : areaQuery.trim(),
        cityId,
        specs: specs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        photos: uploadedPhotos,
        attributes,
      });

      router.replace(`/listing/${listing.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create listing");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.stepper}>
        {(["category", "transactionType", "details", "review"] as Step[]).map((s, i) => (
          <Text key={s} style={{ fontSize: 11, fontWeight: "700", color: step === s ? colors.green : colors.muted }}>
            {i > 0 ? " → " : ""}
            {i + 1}. {s === "category" ? "Category" : s === "transactionType" ? "Transaction" : s === "details" ? "Details" : "Review"}
          </Text>
        ))}
      </View>

      {step === "category" && (
        <View style={{ gap: 10 }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.value}
              onPress={() => selectCategory(c.value)}
              style={[styles.optionButton, { borderColor: category === c.value ? colors.green : colors.border, backgroundColor: category === c.value ? colors.surfaceAlt : colors.surface }]}
            >
              <Text style={{ fontSize: 18 }}>{c.icon}</Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {step === "transactionType" && category && (
        <View style={{ gap: 10 }}>
          {POSTABLE_TRANSACTION_TYPES[category].map((t) => (
            <Pressable
              key={t}
              onPress={() => selectTransactionType(t)}
              style={[styles.optionButton, { borderColor: transactionType === t ? colors.green : colors.border, backgroundColor: transactionType === t ? colors.surfaceAlt : colors.surface }]}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{TRANSACTION_TYPE_LABELS[t]}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setStep("category")}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, marginTop: 4 }}>← Back</Text>
          </Pressable>
        </View>
      )}

      {step === "details" && category && transactionType && (
        <View style={{ gap: 4 }}>
          <Text style={[styles.label, { color: colors.textSoft }]}>Price (₹)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />

          <Text style={[styles.label, { color: colors.textSoft }]}>Price qualifier *</Text>
          <View style={styles.chipRow}>
            {getPriceQualifierOptions(category, transactionType).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPriceQualifier(opt.value)}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: priceQualifier === opt.value ? colors.surfaceAlt : "transparent" }]}
              >
                <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSoft }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />

          <Text style={[styles.label, { color: colors.textSoft }]}>City</Text>
          <View style={styles.chipRow}>
            {cities.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onCityChange(c.id)}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: cityId === c.id ? colors.surfaceAlt : "transparent" }]}
              >
                <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{c.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSoft }]}>Area / locality</Text>
          <TextInput
            value={areaQuery}
            onChangeText={onAreaQueryChange}
            placeholder="Start typing a locality…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {areaSuggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {areaSuggestions.map((a) => (
                <Pressable key={a.id} onPress={() => onPickArea(a)} style={styles.suggestionRow}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>{a.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!areaId && areaQuery.trim().length > 0 && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              No match selected — &quot;{areaQuery.trim()}&quot; will be added as a new area.
            </Text>
          )}

          <Text style={[styles.label, { color: colors.textSoft }]}>Specs (comma-separated, shown on the card)</Text>
          <TextInput
            value={specs}
            onChangeText={setSpecs}
            placeholder="3 Beds, 1450 sqft"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />

          <View style={[styles.divider, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
              {CATEGORIES.find((c) => c.value === category)?.label} details
            </Text>
            {CATEGORY_FIELD_CONFIG[category].map((field) => (
              <View key={field.key}>
                <Text style={[styles.label, { color: colors.textSoft }]}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Text>
                {field.type === "select" ? (
                  <View style={styles.chipRow}>
                    {field.options?.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setAttributes((prev) => ({ ...prev, [field.key]: opt.value }))}
                        style={[
                          styles.chip,
                          { borderColor: colors.border, backgroundColor: attributes[field.key] === opt.value ? colors.surfaceAlt : "transparent" },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={attributes[field.key] ?? ""}
                    onChangeText={(v) => setAttributes((prev) => ({ ...prev, [field.key]: v }))}
                    keyboardType={field.type === "number" ? "number-pad" : "default"}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  />
                )}
              </View>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSoft }]}>Photos (up to {MAX_PHOTOS}) *</Text>
          {photoUris.length < MAX_PHOTOS && (
            <Pressable onPress={pickPhotos} style={[styles.photoButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>
                {photoUris.length > 0 ? "Add more photos" : "Choose photos"}
              </Text>
            </Pressable>
          )}
          {photoUris.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {photoUris.map((uri) => (
                <View key={uri}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <Pressable
                    onPress={() => removePhoto(uri)}
                    style={[styles.removeBadge, { backgroundColor: colors.surface }]}
                  >
                    <Text style={{ color: "#c0554b", fontWeight: "700", fontSize: 13 }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {error && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{error}</Text>}

          <View style={styles.navRow}>
            <Pressable onPress={() => setStep(POSTABLE_TRANSACTION_TYPES[category].length === 1 ? "category" : "transactionType")}>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>← Back</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("review")}
              disabled={!detailsValid}
              style={[styles.reviewButton, { backgroundColor: colors.green, opacity: detailsValid ? 1 : 0.5 }]}
            >
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Review</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "review" && category && transactionType && (
        <View style={{ gap: 12 }}>
          <View style={[styles.reviewBox, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
              {CATEGORIES.find((c) => c.value === category)?.label} — {TRANSACTION_TYPE_LABELS[transactionType]}
            </Text>
            <Text style={{ color: colors.text, marginBottom: 6 }}>{title}</Text>
            <Text style={{ color: colors.muted, marginBottom: 6 }}>
              {areaQuery}, {cities.find((c) => c.id === cityId)?.name}
            </Text>
            <Text style={{ color: colors.green, fontWeight: "700" }}>
              ₹{price} {priceQualifier}
            </Text>
          </View>

          {error && <Text style={{ color: "#c0554b", fontSize: 13 }}>{error}</Text>}

          <View style={styles.navRow}>
            <Pressable onPress={() => setStep("details")}>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>← Back</Text>
            </Pressable>
            <Pressable onPress={onSubmit} disabled={pending} style={[styles.submitButton, { backgroundColor: colors.green, opacity: pending ? 0.6 : 1 }]}>
              {pending ? <ActivityIndicator color={colors.onGreen} /> : (
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Post ad</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  stepper: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
  suggestionsBox: { borderWidth: 1, borderRadius: 9, marginTop: 6, overflow: "hidden" },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, paddingTop: 12, marginTop: 8, gap: 4 },
  photoButton: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  photoThumb: { width: 90, height: 90, borderRadius: 8 },
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
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  reviewButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  submitButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center" },
  reviewBox: { borderWidth: 1, borderRadius: 10, padding: 16 },
});
