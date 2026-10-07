import { Modal, Pressable, Text, View } from "react-native";
import type { BoostPricingPreviewDto } from "@bhavano/types";
import { boostRecoveryMessage, type BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

/**
 * Shown the moment the advertiser taps "Skip — post without featuring" on the ad-preview step's
 * BoostPlanSelector, before the skip is actually committed — mirrors web's BoostRecoveryDialog.tsx,
 * but scoped to just this one trigger (mobile has no idle-timer/submit-intercept equivalent of
 * web's other two). Neither button posts anything: Cancel confirms the skip and returns to the
 * review screen unfeatured, Apply Feature just closes the dialog with the selection untouched
 * (BoostPlanSelector never cleared it — see onSkipAttempt on both platforms).
 */
export function BoostRecoveryDialog({
  pricing,
  effectiveness,
  onApplyFeature,
  onCancel,
}: {
  pricing: BoostPricingPreviewDto;
  effectiveness: BoostEffectivenessDto | null;
  /** Keep the pending Feature selection — just closes the dialog. */
  onApplyFeature: () => void;
  /** Confirm the skip — the deferred commit BoostPlanSelector's tap didn't make directly. */
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const message = boostRecoveryMessage(effectiveness);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000066", alignItems: "center", justifyContent: "center", padding: 20 }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Icon name="boost" size={17} color={colors.gold} />
            <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 17, color: colors.text }}>
              Before you post…
            </Text>
          </View>
          <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 19, marginTop: 8 }}>{message.headline}</Text>
          {!message.hasEnoughData && (
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 4 }}>
              Feature puts your ad higher in search and gives it a badge buyers notice.
            </Text>
          )}
          <View style={{ gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={onApplyFeature}
              style={{ borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: colors.green }}
            >
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Apply Feature</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.muted, textDecorationLine: "underline" }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
