import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { deriveCardSpecs } from "@bhavano/types/cardSpecs";
import { deriveTag } from "@bhavano/types/listingTag";
import { areaUnitShortLabel, type AreaUnit } from "@bhavano/types/areaUnit";
import { formatInrInWords, groupInr, perUnitTotalPrice } from "@bhavano/types/priceWords";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { ListingPrice } from "./PriceWithWords";

/**
 * Mobile counterpart to the web wizard's ListingPreviewCard — same reasoning: the review step
 * used to show a plain text box (category/title/location/price), not what the real ListingCard
 * grid card will actually look like, so a wrong cover photo or an odd-reading price wasn't
 * visible until the ad was already live. Mirrors ListingCard.tsx's visual layout (photo, tag
 * badge, price, title, location, specs) using the same deriveTag/deriveCardSpecs helpers the
 * real card is built from server-side, minus every interactive/persisted-data piece (favourite,
 * message, contact reveal, view/like counts) that doesn't exist yet for an unsubmitted listing.
 */
export function ListingPreviewCard({
  photoUri,
  category,
  transactionType,
  title,
  price,
  priceUnit,
  priceArea,
  priceQualifier,
  areaName,
  cityName,
  attributes,
  featured = false,
}: {
  photoUri: string;
  category: ListingCategory;
  transactionType: TransactionType;
  title: string;
  /** Raw digits as typed, or empty/"0" for a price-on-request category — formatted here the
   * same way the real card's `₹`-prefixed, comma-grouped price is. When `priceUnit` is set, this
   * is the per-unit figure the seller typed; multiplied by `priceArea` it gives the total the
   * listing leads with, the rate beneath it, as on the real card. */
  price: string;
  priceUnit?: AreaUnit;
  priceArea?: number;
  priceQualifier: string;
  areaName: string;
  cityName: string;
  attributes: Record<string, unknown>;
  /** Mirrors `ListingCardDto.isBoosted` — whatever the wizard's Feature selection currently is,
   * not a persisted field, since this listing doesn't exist yet. Drives the same gold-border
   * treatment as the real ListingCard.tsx's `item.isBoosted` block, so this preview never
   * promises a look the real card won't have. */
  featured?: boolean;
}) {
  const { colors } = useAppTheme();
  // Built-in Animated, not Reanimated (installed but unused elsewhere in this app) — a one-shot
  // pulse on every featured toggle, not a persistent animation, so a plain Animated.Value driven
  // by a single useEffect is simpler than reaching for a library with no existing usage pattern
  // here to match.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  }, [featured, pulse]);
  const priceNum = Number(price);
  const exactPrice =
    priceNum > 0 ? `₹${groupInr(priceNum)}${priceUnit ? `/${areaUnitShortLabel(priceUnit, priceNum)}` : ""}` : "Contact for price";
  const wordsPrice =
    priceNum > 0 ? `${formatInrInWords(priceNum)}${priceUnit ? `/${areaUnitShortLabel(priceUnit, 1)}` : ""}` : null;
  const totalPrice =
    priceNum > 0 && priceUnit && priceArea && priceArea > 0
      ? perUnitTotalPrice(Math.round(priceNum * priceArea), priceArea, priceUnit)
      : null;
  const specs = deriveCardSpecs(category, attributes);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        featured ? { borderColor: colors.gold, borderWidth: 1.5 } : { borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      {/* Gold ring that flashes in and fades on every featured/unfeatured toggle — see the pulse
        * useEffect above. Pointer-events none + absolute so it never affects layout or taps. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.pulseRing,
          { borderColor: colors.gold, opacity: pulse, borderRadius: styles.card.borderRadius },
        ]}
      />
      <View style={styles.imageArea}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: colors.green }]}>
            <Text style={{ color: colors.onGreen, fontSize: 10, fontWeight: "700" }}>
              {deriveTag({ category, transactionType })}
            </Text>
          </View>
          {featured && (
            <View style={[styles.tag, styles.featuredTag, { backgroundColor: colors.gold }]}>
              <Icon name="featured" size={11} color="#3a2e0f" filled />
              <Text style={{ color: "#3a2e0f", fontSize: 10, fontWeight: "700" }}>Featured</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <ListingPrice item={{ price: exactPrice, priceInWords: wordsPrice, totalPrice }} fontSize={17} />
          {!!priceQualifier && (
            <View style={[styles.qualifierChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.muted }}>{priceQualifier}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{title || "Untitled listing"}</Text>
        <View style={styles.metaRow}>
          <Icon name="pin" size={11} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {areaName}, {cityName}
          </Text>
        </View>
        {specs.length > 0 && (
          <View style={styles.specsRow}>
            {specs.map((spec) => (
              <Text key={spec} style={{ fontSize: 11.5, fontWeight: "600", color: colors.textSoft }}>
                {spec}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  // aspectRatio, not a fixed height — matches ListingCard.tsx's own imageArea so a wide device
  // doesn't squash or stretch the preview relative to how the browse-grid card will look.
  imageArea: { aspectRatio: 4 / 3, overflow: "hidden" },
  tagRow: { position: "absolute", top: 10, left: 10, flexDirection: "row", gap: 6 },
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  featuredTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  pulseRing: { borderWidth: 2 },
  body: { padding: 14, gap: 8 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  qualifierChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  specsRow: { flexDirection: "row", gap: 10 },
});
