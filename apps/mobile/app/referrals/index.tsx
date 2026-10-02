import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { ReferralStatus } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useMyReferralsQuery } from "../../src/lib/queries";
import { sharedWebUrl } from "../../src/lib/appWebUrl";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import { Icon } from "../../src/components/Icon";

const INVITE_TEXT = "I use Bhavano to buy, sell and rent property. Post your own ad here:";

// Same labels as apps/web's /referrals page. Never the skip reason — a referrer seeing "same
// device" would just learn how to dodge the check.
const STATUS_LABELS: Record<ReferralStatus, string> = {
  signed_up: "Joined — waiting for their first ad",
  ad_approved: "Posted an ad",
  rewarded: "You earned a free boost",
  blocked: "Under review",
  reversed: "Not counted",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The app's twin of apps/web/src/app/referrals/page.tsx — balance, invite link, counts and the
 * people referred. Reached from Account and from every referral push (`data.path`). */
export default function ReferralsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken, requireLogin } = useHomeSheets();
  const { data, isLoading, isError, refetch, isRefetching } = useMyReferralsQuery(accessToken);

  const inviteUrl = data ? sharedWebUrl("/", "referral_invite", data.referralCode) : null;

  function onWhatsApp() {
    if (!inviteUrl) return;
    void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT}\n${inviteUrl}`)}`).catch(
      () => undefined,
    );
  }

  async function onShare() {
    if (!inviteUrl) return;
    try {
      await Share.share({ message: `${INVITE_TEXT}\n${inviteUrl}`, url: inviteUrl });
    } catch {
      // Only a share sheet that failed to open lands here — nothing to recover.
    }
  }

  let body;
  if (!accessToken) {
    body = (
      <View style={{ alignItems: "center", gap: 12, marginTop: 40 }}>
        <Text style={{ color: colors.textSoft, fontSize: 14 }}>Log in to see your referrals.</Text>
        <Pressable onPress={() => requireLogin()} style={[styles.primaryButton, { backgroundColor: colors.green }]}>
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Log in</Text>
        </Pressable>
      </View>
    );
  } else if (isLoading) {
    body = <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />;
  } else if (isError || !data) {
    body = (
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
        Couldn&apos;t load your referrals. Pull down to try again.
      </Text>
    );
  } else {
    const credits = data.availableCredits;
    const soonest = credits[0];
    body = (
      <View style={{ gap: 16 }}>
        <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="boost" size={17} color={colors.gold} />
            <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 16, color: colors.text }}>
              {credits.length === 0
                ? "No free boosts yet"
                : credits.length === 1
                  ? "You have 1 free boost"
                  : `You have ${credits.length} free boosts`}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSoft }}>
            {soonest
              ? `Next one expires on ${dateFormatter.format(new Date(soonest.expiresAt))}. Use it from My listings — tap Boost Ad on any ad.`
              : `Each friend who joins from your link and gets their first ad approved earns you a free ${data.boostDays}-day boost.`}
          </Text>
          {soonest && (
            <Pressable onPress={() => router.push("/my-listings")}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>Go to My listings</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ fontWeight: "700", fontSize: 15, color: colors.text }}>Invite friends</Text>
          <Text style={{ fontSize: 12.5, color: colors.textSoft }} numberOfLines={1}>
            {inviteUrl}
          </Text>
          <Pressable onPress={onWhatsApp} style={[styles.primaryButton, { backgroundColor: colors.green }]}>
            <Icon name="message" size={16} color={colors.onGreen} />
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Invite on WhatsApp</Text>
          </Pressable>
          <Pressable onPress={onShare} style={[styles.outlineButton, { borderColor: colors.green }]}>
            <Icon name="share" size={15} color={colors.green} />
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Share or copy link</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Sharing one of your ads works too — its share button carries your link.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {(
            [
              ["Joined", data.counts.signedUp],
              ["Posted an ad", data.counts.firstAdApproved],
              ["Boosts earned", data.counts.rewarded],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 22, color: colors.text }}>{value}</Text>
              <Text style={{ fontSize: 11.5, color: colors.muted, textAlign: "center" }}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: "700", fontSize: 15, color: colors.text }}>People you referred</Text>
          {data.recent.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted }}>Nobody yet. Share your link to get started.</Text>
          ) : (
            data.recent.map((item) => (
              <View key={item.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>{item.firstName ?? "A friend"}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>
                    Joined {dateFormatter.format(new Date(item.signedUpAt))}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: item.status === "rewarded" ? colors.green : colors.muted,
                    flexShrink: 1,
                    textAlign: "right",
                  }}
                >
                  {STATUS_LABELS[item.status] ?? STATUS_LABELS.signed_up}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: colors.text }}>How it works</Text>
          <Text style={{ fontSize: 12.5, color: colors.muted }}>
            You earn one free {data.boostDays}-day boost for each person who signs up from your link and has their first
            ad approved. Free boosts expire {data.creditExpiryDays} days after you earn them, and you can earn up to{" "}
            {data.monthlyCap} a month ({data.creditsThisMonth} so far this month).
          </Text>
          <Text style={{ fontSize: 12.5, color: colors.muted }}>
            Boosts have no cash value and can&apos;t be transferred. Referrals from the same phone or device as yours
            don&apos;t count.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Referrals & free boosts" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          accessToken ? (
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.green}
              colors={[colors.green]}
              progressBackgroundColor={colors.surface}
            />
          ) : undefined
        }
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  primaryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
