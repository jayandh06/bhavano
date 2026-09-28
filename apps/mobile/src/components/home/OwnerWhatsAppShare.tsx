import { Linking, Pressable, Text, View } from "react-native";
import { priceWithWords } from "@bhavano/types/priceWords";
import type { ListingDetailDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { sharedWebUrl } from "../../lib/appWebUrl";
import { recordAppPageView } from "../../lib/analyticsSession";
import { Icon } from "../Icon";

/**
 * The owner sending their own ad to WhatsApp with the message already written — the app's twin of
 * apps/web's OwnerWhatsAppShare. Every share puts the ad in front of people no ad reaches (society,
 * office and family groups). Tapping records a synthetic `/post/success/share-whatsapp` page view,
 * the app's equivalent of the web's `owner_share_whatsapp` event. See
 * docs/plans/growth-beyond-google-ads.md.
 */
export function OwnerWhatsAppShare({
  listing,
}: {
  listing: Pick<ListingDetailDto, "id" | "title" | "price" | "priceInWords" | "area" | "cityName">;
}) {
  const { colors } = useAppTheme();

  const share = () => {
    const url = sharedWebUrl(`/listings/${listing.id}`, "owner_share");
    const text =
      `${listing.title}\n${priceWithWords(listing.price, listing.priceInWords)} · ${listing.area}, ${listing.cityName}\n` +
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
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Get enquiries sooner</Text>
        <Text style={{ fontSize: 13, color: colors.textSoft }}>
          Send your ad to your society, office or family WhatsApp groups — people nearby often know
          someone looking.
        </Text>
      </View>
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
    </View>
  );
}
