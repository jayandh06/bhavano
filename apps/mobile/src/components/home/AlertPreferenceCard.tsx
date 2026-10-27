import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  OWNER_ALERT_CHANNEL_LABELS,
  OWNER_ALERT_CHANNELS,
  withPrimaryChannel,
  type OwnerAlertChannel,
} from "@bhavano/types/ownerAlerts";
import { useAppTheme } from "../../theme/ThemeContext";
import { saveAlertPreferences } from "../../lib/bffClient";
import { useAlertPreferencesQuery } from "../../lib/queries";
import { Icon } from "../Icon";

const UNAVAILABLE_HINT: Record<OwnerAlertChannel, string> = {
  push: "Turn on notifications for Bhavano to use this",
  whatsapp: "Add your phone number to use this",
  sms: "Add your phone number to use this",
  email: "Add your email address to use this",
};

/** Where the advertiser says how to reach them when a seeker messages, shows interest or views their number. One primary channel is the whole question;
 * the rest follow in order as fallbacks. `compact` is the one-time version shown after posting: only the usable options, nothing once answered. */
export function AlertPreferenceCard({ accessToken, compact = false }: { accessToken: string; compact?: boolean }) {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const { data: preference } = useAlertPreferencesQuery(accessToken);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<OwnerAlertChannel | null>(null);

  if (!preference) return null;
  if (compact && justSaved) {
    return (
      <Text style={{ color: colors.textSoft, fontSize: 13 }}>
        Got it: we&apos;ll alert you by {OWNER_ALERT_CHANNEL_LABELS[justSaved]} first. Change it any time in your profile.
      </Text>
    );
  }
  if (compact && preference.confirmed) return null;

  const options = compact ? OWNER_ALERT_CHANNELS.filter((c) => preference.available[c]) : [...OWNER_ALERT_CHANNELS];
  if (options.length === 0) return null;
  const primary = preference.confirmed ? preference.channels[0] : null;
  const fallbacks = preference.channels.filter((c) => c !== preference.channels[0] && preference.available[c]);

  async function choose(channel: OwnerAlertChannel) {
    if (!preference || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveAlertPreferences(accessToken, withPrimaryChannel(preference.channels, channel));
      queryClient.setQueryData(["alertPreferences", accessToken], saved);
      setJustSaved(channel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name="bell" size={15} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
          {compact ? "How should we alert you when someone contacts you?" : "How should we alert you?"}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
        When someone messages you, shows interest or views your number. The app is the fastest.
      </Text>
      {options.map((channel) => {
        const usable = preference.available[channel];
        const selected = primary === channel;
        return (
          <Pressable
            key={channel}
            disabled={!usable || saving}
            onPress={() => void choose(channel)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !usable }}
            style={[
              styles.option,
              { borderColor: selected ? colors.green : colors.border, opacity: usable ? 1 : 0.55 },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              {OWNER_ALERT_CHANNEL_LABELS[channel]}
              {channel === "push" && usable ? " (fastest)" : ""}
            </Text>
            {!usable && <Text style={{ color: colors.muted, fontSize: 12 }}>{UNAVAILABLE_HINT[channel]}</Text>}
          </Pressable>
        );
      })}
      {!compact && primary && fallbacks.length > 0 && (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
          If that cannot reach you, we try {fallbacks.map((c) => OWNER_ALERT_CHANNEL_LABELS[c]).join(", then ")}.
        </Text>
      )}
      {error && <Text style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  option: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
});
