import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { useAppTheme } from "../../theme/ThemeContext";

/** Per-user so a dismissal doesn't carry over to whoever logs in next on a shared device. */
const dismissKey = (userId: string) => `profileBannerDismissed:${userId}`;

/** Nudges a logged-in user to fill in whichever of email/phone is missing — both matter because
 * account linking merges on them (docs/plans/account-linking-phone-and-email.md), and a user who
 * never opens the Account tab would otherwise never learn their account is incomplete.
 *
 * Renders inline (as the home list's first header row) rather than as the position:absolute
 * overlay this used to be in HomeSheetsProvider: the overlay sat on top of the app's own header
 * and, on notched devices, the status bar. Inline means it pushes content down and scrolls away.
 *
 * Dismissal is deliberately permanent rather than snoozed — a nag that returns on every cold start
 * is the reason people learn to ignore banners. The Account tab still prompts at save time, so the
 * information isn't lost, and the banner disappears on its own once the profile is complete. */
export function ProfileCompletionBanner() {
  const { profile, userId } = useHomeSheets();
  const { colors } = useAppTheme();
  // undefined = still reading storage. Rendering nothing until it resolves avoids a flash of a
  // banner the user already dismissed.
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(dismissKey(userId))
      .then((v) => {
        if (active) setDismissed(v === "1");
      })
      .catch(() => {
        // Storage unavailable is not a reason to hide the nudge — fail open.
        if (active) setDismissed(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const incomplete = profile && (!profile.email || !profile.phone);
  if (!incomplete || !userId || dismissed !== false) return null;

  const missing = [!profile.email && "email", !profile.phone && "phone number"]
    .filter(Boolean)
    .join(" and ");

  async function dismiss() {
    setDismissed(true);
    // Optimistic: the banner is already gone visually. A failed write only means it returns on
    // the next launch, which is a far smaller problem than blocking the tap on storage I/O.
    if (userId) await AsyncStorage.setItem(dismissKey(userId), "1").catch(() => {});
  }

  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.textSoft }]}>
        Add your {missing} to your profile so we can keep you updated.
      </Text>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        // The ✕ glyph is tiny; hitSlop gives it a ~44pt touch target without a bulky layout.
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={[styles.dismiss, { color: colors.muted }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  text: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  dismiss: { fontSize: 15, fontWeight: "700" },
});
