import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ListingInterestDto } from "@bhavano/types";
import type { LeadContactSummaryDto } from "@bhavano/types/seekerContact";
import { whatsAppChatUrl } from "@bhavano/types/whatsapp";
import { useAppTheme } from "../../theme/ThemeContext";
import {
  fetchListingInterests,
  openInterestConversation,
  unlockLeadContact,
} from "../../lib/bffClient";
import { appWebUrl } from "../../lib/appWebUrl";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Owner panel on My listings — who's interested. Message always; when an admin has turned on seeker contact, a Featured ad also shows the person's number
 * (Call / WhatsApp) free, and any other ad can unlock it one person at a time with a contact-reveal credit. Buying credits is on the website (no purchase flow in the app).
 * See docs/plans/featured-seeker-contact-for-owners.md. */
export function ListingInterestsPanel({
  listingId,
  interestCount,
  accessToken,
}: {
  listingId: string;
  interestCount: number;
  accessToken: string;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ListingInterestDto[] | null>(null);
  const [summary, setSummary] = useState<LeadContactSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  async function load() {
    const page = await fetchListingInterests(accessToken, listingId);
    setItems(page.items);
    setSummary(page.leadContact ?? null);
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items) return;
    setLoading(true);
    setError(null);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load interested buyers");
    } finally {
      setLoading(false);
    }
  }

  async function onMessage(userId: string, existingConversationId: string | null) {
    if (existingConversationId) {
      router.push(`/messages/${existingConversationId}`);
      return;
    }
    setMessagingUserId(userId);
    try {
      const { conversationId } = await openInterestConversation(accessToken, listingId, userId);
      router.push(`/messages/${conversationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the conversation");
    } finally {
      setMessagingUserId(null);
    }
  }

  async function onUnlock(userId: string) {
    setUnlockingUserId(userId);
    setError(null);
    try {
      await unlockLeadContact(accessToken, listingId, userId);
      await load();
    } catch (e) {
      if ((e as { status?: number })?.status === 402) {
        setError("You have no contact credits. Buy a pack on the Bhavano website (Profile), or make this ad Featured to see every number free.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't unlock this contact");
      }
    } finally {
      setUnlockingUserId(null);
    }
  }

  /** Records that the owner opened a number they were already allowed to see; no cost. */
  function noteContactTap(userId: string) {
    void unlockLeadContact(accessToken, listingId, userId).catch(() => undefined);
  }

  if (interestCount <= 0) return null;

  const unlockLabel = (userId: string) => {
    if (unlockingUserId === userId) return "…";
    if (!summary) return "Unlock contact";
    if (summary.freeLeadReveals > 0) return "Unlock (free)";
    if (summary.creditsRemaining > 0) return "Unlock · 1 credit";
    return `Unlock · ₹${summary.creditPackPriceRupees}/${summary.creditPackSize}`;
  };

  const pill = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        borderWidth: 1.5,
        borderColor: colors.green,
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ marginTop: 10 }}>
      <Pressable onPress={() => void toggle()}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.green, textDecorationLine: "underline" }}>
          {open ? "Hide" : "Show"} interested buyers ({interestCount})
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            gap: 10,
            backgroundColor: colors.surface,
          }}
        >
          {loading && <ActivityIndicator color={colors.green} />}
          {error ? <Text style={{ color: "#c0554b", fontSize: 13 }}>{error}</Text> : null}
          {items?.map((row) => {
            const wa = row.phone ? whatsAppChatUrl(row.phone, "") : null;
            return (
              <View key={row.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                      {row.userName?.trim() || "Interested buyer"}
                    </Text>
                    {row.revealedYourContact ? (
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.green }}>Unlocked your number</Text>
                    ) : null}
                    <Text style={{ fontSize: 11.5, color: colors.muted }}>
                      Interested {timeFormatter.format(new Date(row.lastSeenAt))}
                    </Text>
                    {row.contact === "available" && row.phone ? (
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 }}>{row.phone}</Text>
                    ) : null}
                    {row.contact === "unlockable" && row.phoneMasked ? (
                      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{row.phoneMasked}</Text>
                    ) : null}
                  </View>
                  {pill(messagingUserId === row.userId ? "…" : "Message", () => void onMessage(row.userId, row.conversationId), messagingUserId === row.userId)}
                </View>
                {row.contact === "available" && row.phone ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {pill("Call", () => {
                      noteContactTap(row.userId);
                      void Linking.openURL(`tel:${row.phone}`).catch(() => undefined);
                    })}
                    {wa
                      ? pill("WhatsApp", () => {
                          noteContactTap(row.userId);
                          void Linking.openURL(wa).catch(() => undefined);
                        })
                      : null}
                  </View>
                ) : null}
                {row.contact === "unlockable" ? (
                  <View style={{ flexDirection: "row" }}>{pill(unlockLabel(row.userId), () => void onUnlock(row.userId), unlockingUserId === row.userId)}</View>
                ) : null}
              </View>
            );
          })}
          {summary?.enabled && !summary.featured && items?.some((r) => r.contact === "unlockable") ? (
            <Pressable onPress={() => void Linking.openURL(appWebUrl(`/my-listings?openBoost=${listingId}`)).catch(() => undefined)}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                A Featured ad shows every interested person&apos;s number free. <Text style={{ fontWeight: "700", color: colors.green, textDecorationLine: "underline" }}>Make it Featured</Text>
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
