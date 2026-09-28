import { Text } from "react-native";
import { formatInrWithWords, priceWordsNote } from "@bhavano/types/priceWords";
import { useAppTheme } from "../../theme/ThemeContext";

/** "₹35,00,000 (35 Lakh)" — the exact figure at `fontSize`, the words smaller and muted after it.
 * Renders just `price` for "Contact for price" or when no words came through. */
export function PriceWithWords({
  price,
  priceInWords,
  fontSize,
}: {
  price: string;
  priceInWords?: string | null;
  fontSize: number;
}) {
  const { colors } = useAppTheme();
  const note = priceWordsNote(price, priceInWords);
  return (
    <Text style={{ flexShrink: 1, fontSize, fontWeight: "700", color: colors.green }}>
      {price}
      {note && (
        <Text style={{ fontSize: Math.round(fontSize * 0.7), fontWeight: "600", color: colors.muted }}> ({note})</Text>
      )}
    </Text>
  );
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
