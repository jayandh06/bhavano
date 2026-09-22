import { Image, StyleSheet, Text, View } from "react-native";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { deriveCardSpecs } from "@bhavano/types/cardSpecs";
import { deriveTag } from "@bhavano/types/listingTag";
import { areaUnitShortLabel, type AreaUnit } from "@bhavano/types/areaUnit";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

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
  priceQualifier,
  areaName,
  cityName,
  attributes,
}: {
  photoUri: string;
  category: ListingCategory;
  transactionType: TransactionType;
  title: string;
  /** Raw digits as typed, or empty/"0" for a price-on-request category — formatted here the
   * same way the real card's `₹`-prefixed, comma-grouped price is. When `priceUnit` is set, this
   * is the per-unit figure the seller typed, not the total the server will compute and store. */
  price: string;
  priceUnit?: AreaUnit;
  priceQualifier: string;
  areaName: string;
  cityName: string;
  attributes: Record<string, unknown>;
}) {
  const { colors } = useAppTheme();
  const priceNum = Number(price);
  const priceDisplay =
    priceNum > 0
      ? `₹${priceNum.toLocaleString("en-IN")}${priceUnit ? `/${areaUnitShortLabel(priceUnit, 1)}` : ""}`
      : "Contact for price";
  const specs = deriveCardSpecs(category, attributes);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.imageArea}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: colors.green }]}>
            <Text style={{ color: colors.onGreen, fontSize: 10, fontWeight: "700" }}>
              {deriveTag({ category, transactionType })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.green }}>{priceDisplay}</Text>
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
  body: { padding: 14, gap: 8 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  qualifierChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  specsRow: { flexDirection: "row", gap: 10 },
});
