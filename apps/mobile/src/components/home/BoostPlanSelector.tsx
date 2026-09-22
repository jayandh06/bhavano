import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { BoostPlanSelection, BoostPricingPreviewDto } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { useAppTheme } from "../../theme/ThemeContext";
import { discountPercentFor } from "@bhavano/types/promoCode";
import { Icon } from "../Icon";

const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

/**
 * Ad-preview-step counterpart to BoostBundleCard — same duration-rows + Instant-Alerts-toggle
 * visual language and the same `optionKey` indexing into `BoostPricingPreviewDto`, but no
 * Pay/Activate button: this only ever reports the advertiser's choice back via `onChange`, and the
 * actual checkout happens after "Post ad" is tapped (PostAdWizard.tsx). Only rendered when the
 * admin has moved the offer here (`pricing.showSelectorOnPreview`) — see
 * docs/plans/boost-instant-alerts-preview-selector.md.
 *
 * `value === null` means the advertiser has explicitly skipped it — still fully optional, unlike
 * BoostBundleCard where "skip" is simply never showing the card. The wizard pre-fills a default
 * (15-day boost + Instant Alerts) the moment a category is picked, so this renders as an already
 * dimmed-in choice — "Skip" is what backs out of that default.
 */
export function BoostPlanSelector({
  pricing,
  value,
  onChange,
}: {
  pricing: BoostPricingPreviewDto;
  value: BoostPlanSelection | null;
  onChange: (value: BoostPlanSelection | null) => void;
}) {
  const { colors } = useAppTheme();
  const effective: BoostPlanSelection = value ?? { duration: 15, includeInstantAlerts: true };

  const optionKey =
    effective.duration === 7
      ? effective.includeInstantAlerts
        ? "boost7WithInstantAlerts"
        : "boost7"
      : effective.includeInstantAlerts
        ? "boost15WithInstantAlerts"
        : "boost15";
  const option = pricing[optionKey];

  function priceText(opt: BoostPricingPreviewDto["boost7"]): string {
    if (opt.free) return "Free";
    return opt.discountApplied ? `₹${opt.originalAmount} → ₹${opt.amount}` : `₹${opt.amount}`;
  }

  return (
    <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt, opacity: value ? 1 : 0.55 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="boost" size={17} color={colors.gold} />
        <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 15, color: colors.text }}>
          Boost this ad
          {/* Appended only while a discount is actually live on the option being shown, and
              computed from its own amount/originalAmount rather than a hardcoded "50" — the real
              percent lives on an admin-edited DiscountCode row, so this can't quietly go stale. */}
          {option.discountApplied && (
            <Text style={{ color: colors.gold }}> — {discountPercentFor(option.amount, option.originalAmount)}% OFF</Text>
          )}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {BOOST_DURATIONS.map((days) => {
          const selected = !!value && effective.duration === days;
          return (
            <Pressable
              key={days}
              onPress={() => onChange({ duration: days, includeInstantAlerts: effective.includeInstantAlerts })}
              style={[
                styles.optionButton,
                {
                  borderColor: selected ? colors.green : colors.border,
                  backgroundColor: selected ? `${colors.green}1a` : colors.surface,
                },
              ]}
            >
              <Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: colors.text }}>Boost {days} days</Text>
              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>
                {priceText(days === 7 ? pricing.boost7 : pricing.boost15)}
              </Text>
            </Pressable>
          );
        })}

        <View
          style={[
            styles.optionButton,
            { borderColor: colors.border, backgroundColor: colors.surface, justifyContent: "space-between" },
          ]}
        >
          <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>Add Instant Alerts</Text>
          <Switch
            value={effective.includeInstantAlerts}
            onValueChange={(next) => onChange({ duration: effective.duration, includeInstantAlerts: next })}
          />
        </View>
      </View>

      <Text style={{ fontWeight: "700", fontSize: 13, color: colors.green, marginTop: 12 }}>
        {value ? `Total: ${priceText(option)}` : "Not boosting this ad"}
      </Text>

      <Pressable onPress={() => onChange(value ? null : effective)} style={{ marginTop: 10 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.muted, textDecorationLine: "underline" }}>
          {value ? "Skip — post without boosting" : "Add it back"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 18 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
});
