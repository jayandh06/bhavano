import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { RequirementFeedCardDto } from "@bhavano/types/requirementFeed";
import { convertArea, formatArea } from "@bhavano/types/areaUnit";
import { bedroomLabel } from "@bhavano/types/bedrooms";
import { formatCompactInr } from "@bhavano/types/requirementQuestions";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const DAY_MS = 24 * 60 * 60 * 1000;

function postedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function budgetText(card: RequirementFeedCardDto): string | null {
  const { minPrice, maxPrice } = card;
  if (minPrice && maxPrice) return `${formatCompactInr(minPrice)}–${formatCompactInr(maxPrice)} ${card.budgetUnit}`;
  if (maxPrice) return `Up to ${formatCompactInr(maxPrice)} ${card.budgetUnit}`;
  if (minPrice) return `From ${formatCompactInr(minPrice)} ${card.budgetUnit}`;
  return null;
}

function sizeText(card: RequirementFeedCardDto): string | null {
  const unit = card.areaUnit ?? "sqft";
  const show = (sqft: number) => formatArea(Math.round(convertArea(sqft, "sqft", unit) * 100) / 100, unit);
  if (card.minAreaSqft && card.maxAreaSqft) return `${show(card.minAreaSqft)} – ${show(card.maxAreaSqft)}`;
  if (card.maxAreaSqft) return `Up to ${show(card.maxAreaSqft)}`;
  if (card.minAreaSqft) return `At least ${show(card.minAreaSqft)}`;
  return null;
}

function moveInText(iso: string | undefined): string {
  if (!iso) return "Just exploring";
  const date = new Date(iso);
  return date.getTime() <= Date.now() ? "Needs it now" : `Move in by ${dateFormatter.format(date)}`;
}

/**
 * Mobile counterpart to web's `FeedCard` (RequirementsFeedPage.tsx) — same facts, same order.
 * "Post a matching ad" opens the Post tab plain, with no preset category/transactionType/city the
 * way web's does: mobile's PostAdWizard has no equivalent preset props yet (see its own file —
 * only `defaultCityId`), so wiring that through is left for when it's actually needed rather than
 * guessed at here.
 */
export function RequirementFeedCard({ card }: { card: RequirementFeedCardDto }) {
  const { colors } = useAppTheme();
  const router = useRouter();

  const facts = [
    card.bedroomOptions.length ? `${card.bedroomOptions.map(bedroomLabel).join(", ")} BHK` : null,
    budgetText(card),
    sizeText(card),
    moveInText(card.moveInBy),
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{card.label}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: card.openToCalls ? `${colors.green}1a` : colors.surfaceAlt },
          ]}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: card.openToCalls ? colors.green : colors.muted }}>
            {card.openToCalls ? "Open to calls" : "Messages only"}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
        {[card.areaNames.join(", "), card.cityName].filter(Boolean).join(" · ")}
      </Text>

      <View style={styles.chipsRow}>
        {facts.map((fact) => (
          <View key={fact} style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ fontSize: 12, color: colors.text }}>{fact}</Text>
          </View>
        ))}
        {card.details.map((d) => (
          <View key={d.label} style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ fontSize: 12, color: colors.text }}>
              {d.label}: {d.values.join(", ")}
            </Text>
          </View>
        ))}
      </View>

      {card.unanswered.length > 0 && (
        <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 6 }}>{card.unanswered.join(" · ")}</Text>
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, color: colors.muted }}>
            Posted {postedAgo(card.createdAt)}
            {card.updatedAt ? ` · updated ${postedAgo(card.updatedAt)}` : ""}
          </Text>
          {card.matchingListingCount > 0 && (
            <Pressable onPress={() => router.push("/my-listings")} hitSlop={4}>
              <Text style={{ fontSize: 11.5, color: colors.green, fontWeight: "700", marginTop: 2 }}>
                {card.matchingListingCount === 1 ? "1 of your listings fits" : `${card.matchingListingCount} of your listings fit`}
              </Text>
            </Pressable>
          )}
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Contact details aren&rsquo;t shared</Text>
        </View>
        <Pressable
          onPress={() => router.push("/post?from=requirements_feed")}
          style={[styles.postButton, { backgroundColor: colors.green }]}
        >
          <Icon name="postAd" size={14} color={colors.onGreen} />
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.onGreen }}>Post a matching ad</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontSize: 15.5, fontWeight: "700" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
});
