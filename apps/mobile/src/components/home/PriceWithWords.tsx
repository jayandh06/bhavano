import { Text, View } from "react-native";
import {
  compactPrice,
  formatInrWithWords,
  listingHeadlinePrice,
  priceWordsNote,
  type ListingPriceFields,
} from "@bhavano/types/priceWords";
import { useAppTheme } from "../../theme/ThemeContext";

/** "₹35,00,000 (35 Lakh)" — the exact figure at `fontSize`, the words smaller and muted after it.
 * `compact` (browse cards) shows just "₹35 Lakh" from ₹1 lakh up. `rate` is a per-unit listing's
 * "₹5,000/sq ft · 1,200 sq ft", on its own smaller line. Renders just `price` for "Contact for
 * price" or when no words came through. */
export function PriceWithWords({
  price,
  priceInWords,
  fontSize,
  compact = false,
  rate,
}: {
  price: string;
  priceInWords?: string | null;
  fontSize: number;
  compact?: boolean;
  rate?: string | null;
}) {
  const { colors } = useAppTheme();
  const note = compact ? null : priceWordsNote(price, priceInWords);
  const headline = (
    <Text style={{ flexShrink: 1, fontSize, fontWeight: "700", color: colors.green }}>
      {compact ? compactPrice(price, priceInWords) : price}
      {note && (
        <Text style={{ fontSize: Math.round(fontSize * 0.7), fontWeight: "600", color: colors.muted }}> ({note})</Text>
      )}
    </Text>
  );
  if (!rate) return headline;
  return (
    <View style={{ flexShrink: 1 }}>
      {headline}
      <Text style={{ fontSize: Math.round(fontSize * 0.65), fontWeight: "600", color: colors.muted, marginTop: 1 }}>{rate}</Text>
    </View>
  );
}

/** A listing DTO's price — a per-unit listing leads with its total, the rate beneath. */
export function ListingPrice({
  item,
  fontSize,
  compact = false,
}: {
  item: ListingPriceFields;
  fontSize: number;
  compact?: boolean;
}) {
  const { price, priceInWords, rate } = listingHeadlinePrice(item);
  return <PriceWithWords price={price} priceInWords={priceInWords} fontSize={fontSize} compact={compact} rate={rate} />;
}

/** Live read-back under a price box — "₹35,00,000 (35 Lakh)" — so a typo'd extra zero shows
 * before saving. Nothing below ₹1,000, where there are no words. */
export function PriceWordsHint({ value, suffix = "" }: { value: string; suffix?: string }) {
  const { colors } = useAppTheme();
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1_000) return null;
  return (
    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
      {formatInrWithWords(amount)}
      {suffix}
    </Text>
  );
}

/** Under a per-unit price box: what the whole listing comes to — "= ₹60,00,000 (60 Lakh) for
 * 1,200 sq ft". Nothing until both the rate and the area are filled in. */
export function PerUnitTotalHint({ total, area }: { total: number | null; area: string | null }) {
  const { colors } = useAppTheme();
  if (total === null || !(total > 0) || !area) return null;
  return (
    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSoft, marginTop: 2 }}>
      = {formatInrWithWords(total)} for {area}
    </Text>
  );
}
