import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { listingPriceText } from "@bhavano/types/priceWords";
import type { ListingDetailDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { sharedWebUrl } from "../../lib/appWebUrl";
import { recordAppPageView } from "../../lib/analyticsSession";
import { Icon } from "../Icon";

/**
 * The owner sending their own ad to WhatsApp with the message already written — the app's twin of
 * apps/web's OwnerWhatsAppShare. Every share puts the ad in front of people no ad reaches (society,
 * office and family groups). Tapping records a synthetic `/post/success/share-whatsapp` page view,
 * the app's equivalent of the web's `owner_share_whatsapp` event. See
 * docs/plans/growth-beyond-google-ads.md.
 *
 * The link carries the owner's id as `ref`, crediting them under the referral programme.
 */
export function OwnerWhatsAppShare({
  listing,
}: {
  listing: Pick<
    ListingDetailDto,
    "id" | "title" | "price" | "priceInWords" | "totalPrice" | "area" | "cityName" | "viewerReferralCode"
  >;
}) {
  const { colors } = useAppTheme();
  const { userId } = useHomeSheets();
  const router = useRouter();
  const code = listing.viewerReferralCode ?? userId;

  const share = () => {
    const url = sharedWebUrl(`/listings/${listing.id}`, "owner_share", code);
    const text =
      `${listing.title}\n${listingPriceText(listing, "compact")} · ${listing.area}, ${listing.cityName}\n` +
      `Photos and details on Bhavano — message me there:\n${url}`;
    void recordAppPageView("/post/success/share-whatsapp");
    // wa.me opens the WhatsApp app when installed and WhatsApp Web otherwise, so there is no
    // "not installed" case to handle here.
    void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => undefined);
  };

  return (
    <View
      style={{
        width: "100%",
        borderWidth: 1,
        borderRadius: 16,
        padding: 18,
        gap: 12,
        borderColor: code ? colors.gold : colors.border,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      {code ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="boost" size={15} color={colors.gold} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Share your ad and earn a free Feature</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSoft }}>
            Send it to your society, office or family WhatsApp groups to get enquiries sooner. When someone joins
            Bhavano from your link and their first ad is approved, you get a free Feature for any of your ads.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Get enquiries sooner</Text>
          <Text style={{ fontSize: 13, color: colors.textSoft }}>
            Send your ad to your society, office or family WhatsApp groups — people nearby often know
            someone looking.
          </Text>
        </View>
      )}
      <Pressable
        onPress={share}
        style={{
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 28,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.green,
        }}
      >
        <Icon name="message" size={16} color={colors.onGreen} />
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Share on WhatsApp</Text>
      </Pressable>
      {code && (
        <Text onPress={() => router.push("/referrals")} style={{ fontSize: 12.5, fontWeight: "700", color: colors.green }}>
          How referrals work
        </Text>
      )}
    </View>
  );
}
