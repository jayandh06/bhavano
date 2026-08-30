import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import type { Area, City, ListingCategory, ReverseGeocodeResultDto, TransactionType } from "@bhavano/types";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  pruneHiddenAttributes,
} from "@bhavano/types/categoryFields";
import { POST_CATEGORIES, POST_CATEGORY_GROUPS } from "@bhavano/types/postCategories";
import { clampPrice, TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { useAppTheme } from "../../theme/ThemeContext";
import { createListing, fetchAreas, uploadPhoto } from "../../lib/bffClient";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { LocationMapPicker } from "./LocationMapPicker";

type FieldConfig = (typeof CATEGORY_FIELD_CONFIG)[ListingCategory][number];

/** Short two- or three-option fields stay inline as a segmented control — seeing every choice at
 * once is worth the row it costs. Anything longer (facing has eight) wraps chips over three rows
 * and pushes the rest of the form off screen, so it collapses to a single row that opens a picker
 * sheet instead. */
function isSegmented(field: FieldConfig): boolean {
  return (
    field.type === "select" &&
    !!field.options &&
    field.options.length <= 3 &&
    field.options.every((o) => o.label.length <= 12)
  );
}

/** Small whole numbers get a stepper rather than a keyboard: no keypad, no way to type "abc" or
 * a negative, and the value is visible without tapping in.
 *
 * Two ways in. `stepper: true` in the shared field config is the explicit one, and covers
 * bedrooms and bathrooms — which the naming rule below misses, since neither ends in "Count"
 * despite being exactly the same kind of question. The suffix rule stays for the furnishing and
 * amenity counts, which are numerous and would be tedious to flag one by one. */
function isCounter(field: FieldConfig): boolean {
  return field.type === "number" && (field.stepper === true || field.key.endsWith("Count"));
}

/** Upper bound from the field's own `maxDigits` (the config already carries it), defaulting to two
 * digits: nobody lists 100 balconies, and an unbounded field invites a typo that ships. */
function maxCountFor(field: FieldConfig): number {
  return 10 ** (field.maxDigits ?? 2) - 1;
}

/** Counters start at 0 and yes/no toggles at "no", so the form opens in a stated, submittable
 * state instead of a page of blanks the seller must confirm one by one. Only fields the seller
 * has not touched are seeded — selectCategory clears attributes first, so this never overwrites. */
function defaultAttributesFor(category: ListingCategory): Record<string, string | string[]> {
  const defaults: Record<string, string | string[]> = {};
  for (const field of CATEGORY_FIELD_CONFIG[category]) {
    if (isCounter(field)) defaults[field.key] = "0";
    // Multi-selects open on their first option (Family, for preferred tenant type) rather than
    // empty — the common answer, and it stops a required multi-select blocking submission before
    // the seller has looked at it. Still fully deselectable.
    else if (field.type === "multi-select" && field.options?.[0]) defaults[field.key] = [field.options[0].value];
    else if (field.options?.some((o) => o.value === "no") && field.options.length === 2) {
      defaults[field.key] = "no";
    }
  }
  return defaults;
}

/** Keyboards can be bypassed — paste, autofill, and hardware keyboards all reach a number-pad
 * field — so digits are enforced on the value, not just requested via keyboardType. Mirrors the
 * web wizard's sanitizeNonNegative + clampDigits. */
function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Truncates to the field's own `maxDigits`, so a percent field can't take a third digit. */
function clampDigits(value: string, maxDigits: number | undefined): string {
  return maxDigits === undefined ? value : value.slice(0, maxDigits);
}

/** A price is what the listing is for; 0 or blank is not a listing. Kept as its own predicate so
 * the Review gate and the inline message can never disagree about what counts as valid. */
function priceIsValid(price: string): boolean {
  return Number(price) > 0;
}

/** Wide enough for any realistic rupee amount, narrow enough that a stuck key can't produce a
 * number the BFF then has to reject. */

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sell: "Sell",
  buy: "Buy",
  rent: "Rent out",
  lease: "Lease out",
};

type Step = "category" | "transactionType" | "details" | "review";

export function PostAdWizard({
  cities,
  defaultCityId,
  accessToken,
}: {
  cities: City[];
  defaultCityId?: string;
  accessToken: string;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [listingId] = useState(() => Crypto.randomUUID());

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const [cityId, setCityId] = useState(defaultCityId ?? cities[0]?.id ?? "");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const optionSheetRef = useRef<BottomSheetModal>(null);
  const [openField, setOpenField] = useState<FieldConfig | null>(null);
  /** Cities the map pin resolved that aren't in the `cities` prop. Kept separate rather than
   * copying the prop into state, so a later prop update can't be silently shadowed. */
  const [pinResolvedCities, setPinResolvedCities] = useState<City[]>([]);
  const cityOptions = useMemo(
    () => [...cities, ...pinResolvedCities.filter((p) => !cities.some((c) => c.id === p.id))],
    [cities, pinResolvedCities],
  );
  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  const [title, setTitle] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<Area[]>([]);
  const areaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [specs, setSpecs] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  // string[] for multi-select fields (preferredTenantTypes); the attributes column is JSONB and
  // typed Record<string, unknown> on the wire, so an array round-trips as-is.
  const [attributes, setAttributes] = useState<Record<string, string | string[]>>({});
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectCategory(next: ListingCategory) {
    setCategory(next);
    setAttributes(defaultAttributesFor(next));
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

  function countOf(key: string): number {
    const raw = attributes[key];
    return typeof raw === "string" ? Number(raw) || 0 : 0;
  }

  function bumpCount(field: FieldConfig, delta: number) {
    setAttributes((prev) => {
      const current = typeof prev[field.key] === "string" ? Number(prev[field.key]) || 0 : 0;
      const next = Math.min(maxCountFor(field), Math.max(0, current + delta));
      return { ...prev, [field.key]: String(next) };
    });
  }

  function toggleMulti(key: string, value: string) {
    setAttributes((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  /** Google's City/Area resolution is a suggestion, never auto-locked — the user can still
   * change the City chip / Area field manually after the map pre-fills them. */
  function onPinChange(nextPin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) {
    setPin(nextPin);
    if (!suggestion) return;
    if (suggestion.cityId) {
      // The pin can resolve a city outside the `cities` prop (it holds popular cities only), in
      // which case selecting its id used to leave nothing selected in the picker and a blank city
      // on the review step. Carry it alongside, as the web wizard does with its own city list.
      if (!cities.some((c) => c.id === suggestion.cityId)) {
        setPinResolvedCities((prev) =>
          prev.some((c) => c.id === suggestion.cityId)
            ? prev
            : [
                ...prev,
                {
                  id: suggestion.cityId!,
                  name: suggestion.cityName ?? suggestion.resolvedLocality,
                  state: "",
                  lat: nextPin.lat,
                  lng: nextPin.lng,
                  isPopular: false,
                },
              ],
        );
      }
      onCityChange(suggestion.cityId);
    }
    // `resolvedLocality` always comes back; `areaId` only when Google's locality matched an
    // existing Bhavano Area. Filling the text either way is the point of the pin — gating both on
    // areaId left the field blank for every locality we don't have a row for yet, which reads as
    // "the map did nothing". Without a match the id stays null, so submission sends `areaName` and
    // the area gets created, exactly as typing it by hand would.
    if (suggestion.resolvedLocality) {
      setAreaId(suggestion.areaId ?? null);
      setAreaQuery(suggestion.resolvedLocality);
      setAreaSuggestions([]);
    }
  }

  /** Mirrors the desktop wizard: a field appears only when it applies to this transaction type
   * and its `dependsOn` gate is satisfied. Without this mobile showed both brokerage amount
   * fields at once — the ₹ one is rent/lease-only, the % one sell-only — and showed them even
   * when "Has brokerage fee" was No. */
  const visibleFields =
    category && transactionType
      ? CATEGORY_FIELD_CONFIG[category].filter((field) => fieldIsVisible(field, transactionType, attributes))
      : [];

  // Only currently-visible required fields block submission — one hidden behind an unmet gate
  // can't be filled in anyway.
  const requiredAttributesFilled = category
    ? visibleFields.every((field) => {
        if (!field.required) return true;
        const value = attributes[field.key];
        // An empty multi-select is [] rather than "", and [].length works the same — but a bare
        // `?? ""` would have turned the array into a string and passed on "family,company".
        return Array.isArray(value) ? value.length > 0 : (value ?? "").length > 0;
      })
    : true;

  const detailsValid =
    priceIsValid(price) &&
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
        const upload = await uploadPhoto(photoUris[i], listingId, photoNo, accessToken);
        uploadedPhotos.push({ photoNo, hash: upload.hash, ext: upload.ext });
      }

      const listing = await createListing(
        {
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
          attributes: pruneHiddenAttributes(category, transactionType, attributes),
          lat: pin?.lat,
          lng: pin?.lng,
        },
        accessToken,
      );

      router.replace(`/listing/${listing.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create listing");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
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
        <View style={{ gap: 22 }}>
          {POST_CATEGORY_GROUPS.map((group) => (
            <View key={group.title} style={{ gap: 10 }}>
              <Text style={[styles.groupHeading, { color: colors.textSoft }]}>{group.title.toUpperCase()}</Text>
              {group.options.map((c) => (
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
          <Text style={[styles.label, { color: colors.textSoft }]}>Price (₹) *</Text>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(clampPrice(v, transactionType))}
            keyboardType="number-pad"
            placeholder="e.g. 25000"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {price.length > 0 && !priceIsValid(price) && (
            <Text style={styles.fieldError}>Enter a price greater than 0.</Text>
          )}

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

          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={[styles.label, { color: colors.textSoft }]}>Title</Text>
            {/* Counts up rather than down, so it reads as progress instead of a warning, and
                turns amber before the cap rather than at it — running out mid-sentence is worth
                knowing a few characters early. */}
            <Text
              style={{
                fontSize: 12,
                color:
                  title.length >= TITLE_MAX_LENGTH
                    ? "#b3413a"
                    : title.length > TITLE_MAX_LENGTH - 20
                      ? colors.green
                      : colors.muted,
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

          <Text style={[styles.label, { color: colors.textSoft }]}>
            Pin your exact location (optional — helps buyers find you, and auto-fills City/Area below)
          </Text>
          <LocationMapPicker
            defaultCenter={cityOptions.find((c) => c.id === cityId) ?? cities[0] ?? { lat: 20.5937, lng: 78.9629 }}
            onPinChange={onPinChange}
          />

          <Text style={[styles.label, { color: colors.textSoft }]}>City</Text>
          {/* Collapsed by default. Rendering a chip for every city pushed the rest of the form off
              screen and, worse, hid the fact that dropping a map pin had already chosen one —
              the selection was a subtly different chip background somewhere in a wall of chips. */}
          <Pressable
            onPress={() => setCityPickerOpen((open) => !open)}
            style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
              {cityOptions.find((c) => c.id === cityId)?.name ?? "Select a city"}
            </Text>
            <Text style={{ color: colors.green, fontSize: 12.5, fontWeight: "700" }}>
              {cityPickerOpen ? "Done" : "Change"}
            </Text>
          </Pressable>
          {cityPickerOpen && (
            <View style={styles.chipRow}>
              {cityOptions.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onCityChange(c.id);
                    setCityPickerOpen(false);
                  }}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: cityId === c.id ? colors.surfaceAlt : "transparent" }]}
                >
                  <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

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
              {POST_CATEGORIES.find((c) => c.value === category)?.label} details
            </Text>
            {/* Grouped into the config's own sections (pricing, preferences, …) in SECTION_ORDER,
                the same helper the desktop wizard uses — one flat run of twenty-odd controls gave
                the seller no sense of where they were or how much was left. */}
            {groupFieldsBySection(visibleFields).map((group) => (
            <View key={group.section}>
            <Text
              style={[
                styles.sectionHeading,
                { color: colors.green, backgroundColor: colors.surfaceAlt, borderLeftColor: colors.green },
              ]}
            >
              {group.label}
            </Text>
            <View style={styles.attrGrid}>
            {group.fields.map((field) => {
              const segmented = isSegmented(field);
              const counter = isCounter(field);
              const selectedOption = field.options?.find((o) => o.value === attributes[field.key]);
              const chosen = Array.isArray(attributes[field.key]) ? (attributes[field.key] as string[]) : [];
              const summaryLabel =
                field.type === "multi-select"
                  ? field.options
                      ?.filter((o) => chosen.includes(o.value))
                      .map((o) => o.label)
                      .join(", ") || null
                  : (selectedOption?.label ?? null);

              return (
              // Two per row: these are mostly one-word labels over a small control, so a full-width
              // row wasted most of its width and made the section three screens long.
              <View key={field.key} style={styles.attrCell}>
                <Text style={[styles.label, { color: colors.textSoft }]} numberOfLines={2}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Text>
                {counter ? (
                  <View style={[styles.counter, { borderColor: colors.border }]}>
                    <Pressable
                      onPress={() => bumpCount(field, -1)}
                      hitSlop={8}
                      style={[styles.counterButton, { borderRightWidth: 1, borderRightColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>−</Text>
                    </Pressable>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" }}>
                      {countOf(field.key)}
                    </Text>
                    <Pressable
                      onPress={() => bumpCount(field, 1)}
                      hitSlop={8}
                      style={[styles.counterButton, { borderLeftWidth: 1, borderLeftColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>+</Text>
                    </Pressable>
                  </View>
                ) : segmented ? (
                  <View style={[styles.segmented, { borderColor: colors.border }]}>
                    {field.options?.map((opt, i) => {
                      const selected = attributes[field.key] === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setAttributes((prev) => ({ ...prev, [field.key]: opt.value }))}
                          style={[
                            styles.segment,
                            i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                            selected && { backgroundColor: colors.green },
                          ]}
                        >
                          <Text
                            style={{ color: selected ? colors.onGreen : colors.text, fontSize: 12.5, fontWeight: "700" }}
                            numberOfLines={1}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : field.type === "multi-select" || field.type === "select" ? (
                  <Pressable
                    onPress={() => {
                      setOpenField(field);
                      optionSheetRef.current?.present();
                    }}
                    style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Text
                      style={{ color: summaryLabel ? colors.text : colors.muted, fontSize: 13.5, flex: 1 }}
                      numberOfLines={1}
                    >
                      {summaryLabel ?? "Select…"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>▾</Text>
                  </Pressable>
                ) : (
                  <TextInput
                    value={typeof attributes[field.key] === "string" ? (attributes[field.key] as string) : ""}
                    onChangeText={(v) =>
                      setAttributes((prev) => ({
                        ...prev,
                        [field.key]: field.type === "number" ? clampDigits(digitsOnly(v), field.maxDigits) : v,
                      }))
                    }
                    keyboardType={field.type === "number" ? "number-pad" : "default"}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  />
                )}
              </View>
              );
            })}
            </View>
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
              {POST_CATEGORIES.find((c) => c.value === category)?.label} — {TRANSACTION_TYPE_LABELS[transactionType]}
            </Text>
            <Text style={{ color: colors.text, marginBottom: 6 }}>{title}</Text>
            <Text style={{ color: colors.muted, marginBottom: 6 }}>
              {areaQuery}, {cityOptions.find((c) => c.id === cityId)?.name}
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

    {/* One sheet reused by every collapsed select, driven by `openField` — a modal per field would
        mount a dozen sheets for a form the user mostly scrolls past. Sits outside the ScrollView
        so it isn't clipped by it. */}
    <BottomSheetModal
      ref={optionSheetRef}
      snapPoints={["50%"]}
      backgroundStyle={{ backgroundColor: colors.surface }}
      onDismiss={() => setOpenField(null)}
    >
      <BottomSheetView style={styles.optionSheet}>
        <Text style={[styles.optionSheetTitle, { color: colors.text }]}>{openField?.label}</Text>
        {openField?.options?.map((opt) => {
          const multi = openField.type === "multi-select";
          const current = attributes[openField.key];
          const selected = multi
            ? Array.isArray(current) && current.includes(opt.value)
            : current === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (multi) {
                  // Stays open: picking one tenant type usually means picking another, and a sheet
                  // that closes on every tap would have to be reopened for each.
                  toggleMulti(openField.key, opt.value);
                } else {
                  setAttributes((prev) => ({ ...prev, [openField.key]: opt.value }));
                  optionSheetRef.current?.dismiss();
                }
              }}
              style={styles.optionRow}
            >
              <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{opt.label}</Text>
              {selected && <Text style={{ color: colors.green, fontSize: 15, fontWeight: "700" }}>✓</Text>}
            </Pressable>
          );
        })}
        {openField?.type === "multi-select" && (
          <Pressable
            onPress={() => optionSheetRef.current?.dismiss()}
            style={[styles.doneButton, { backgroundColor: colors.green }]}
          >
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Done</Text>
          </Pressable>
        )}
      </BottomSheetView>
    </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  stepper: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
  groupHeading: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
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
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    // A filled bar with a green rule down its left edge: at a glance the seller can see where one
    // group of fields ends and the next begins while scrolling, which a plain small-caps line
    // above a divider did not achieve.
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 22,
    marginBottom: 10,
    overflow: "hidden",
  },
  fieldError: { color: "#c0554b", fontSize: 12, marginTop: 4 },
  attrGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12 },
  attrCell: { width: "47%", flexGrow: 1 },
  counter: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  counterButton: { paddingVertical: 9, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  optionSheet: { paddingHorizontal: 20, paddingBottom: 24 },
  optionSheetTitle: { fontWeight: "700", fontSize: 17, marginBottom: 12 },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  doneButton: { borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
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
