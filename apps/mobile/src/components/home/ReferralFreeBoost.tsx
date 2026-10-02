import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { BoostPricingPreviewDto } from "@bhavano/types";
import type { PurchaseSource } from "@bhavano/types/purchaseSource";
import { useAppTheme } from "../../theme/ThemeContext";
import { redeemReferralBoost } from "../../lib/bffClient";

type ReferralCredit = NonNullable<BoostPricingPreviewDto["referralCredit"]>;

const expiryFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** "Use free boost" for a user holding a referral credit — the app's twin of the green block in
 * apps/web's BoostBundlePicker. Activates server-side straight away, no checkout. */
export function ReferralFreeBoost({
  credit,
  listingId,
  accessToken,
  source,
  showPaidHint,
  onActivated,
}: {
  credit: ReferralCredit;
  listingId: string;
  accessToken: string;
  source?: PurchaseSource;
  /** Paid options are shown below this block. */
  showPaidHint: boolean;
  onActivated: () => void;
}) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUse() {
    setPending(true);
    setError(null);
    try {
      await redeemReferralBoost(accessToken, listingId, source);
      onActivated();
    } catch {
      setError("Couldn't use your free boost — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: colors.green,
        backgroundColor: `${colors.green}1a`,
        borderRadius: 10,
        padding: 14,
        gap: 10,
        marginBottom: 14,
      }}
    >
      <Text style={{ fontSize: 13.5, color: colors.text }}>
        <Text style={{ fontWeight: "700" }}>
          {credit.available === 1 ? "You have a free boost" : `You have ${credit.available} free boosts`}
        </Text>{" "}
        from referring friends. Use one now for {credit.days} days, free.{" "}
        <Text style={{ color: colors.muted }}>Expires {expiryFormatter.format(new Date(credit.expiresAt))}.</Text>
      </Text>
      <Pressable
        onPress={onUse}
        disabled={pending}
        style={{
          borderRadius: 8,
          paddingVertical: 11,
          alignItems: "center",
          backgroundColor: colors.green,
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? (
          <ActivityIndicator color={colors.onGreen} />
        ) : (
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Use free {credit.days}-day boost</Text>
        )}
      </Pressable>
      {error && <Text style={{ color: "#c0554b", fontSize: 13 }}>{error}</Text>}
      {showPaidHint && (
        <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>or pay for a longer boost below</Text>
      )}
    </View>
  );
}
