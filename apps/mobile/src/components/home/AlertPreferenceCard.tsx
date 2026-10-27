import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  OWNER_ALERT_CHANNEL_LABELS,
  OWNER_ALERT_CHANNELS,
  isPaidOwnerAlertChannel,
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
 * the rest follow in order as fallbacks. WhatsApp and SMS are tagged Featured: they are used for Featured ads only. */
export function AlertPreferenceCard({ accessToken }: { accessToken: string }) {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const { data: preference } = useAlertPreferencesQuery(accessToken);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!preference) return null;
  const options = [...OWNER_ALERT_CHANNELS];
  const primary = preference.confirmed ? preference.channels[0] : null;
  const fallbacks = preference.channels.filter((c) => c !== preference.channels[0] && preference.available[c]);

  async function choose(channel: OwnerAlertChannel) {
    if (!preference || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveAlertPreferences(accessToken, withPrimaryChannel(preference.channels, channel));
      queryClient.setQueryData(["alertPreferences", accessToken], saved);
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
          How should we alert you?
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
        When someone messages you, shows interest or views your number. App notifications and email are free; WhatsApp and SMS are included with Featured ads.
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
              <Text style={{ color: colors.muted, fontWeight: "400" }}>
                {isPaidOwnerAlertChannel(channel) ? "  Featured ads" : channel === "push" ? " (free, fastest)" : " (free)"}
              </Text>
            </Text>
            {!usable && <Text style={{ color: colors.muted, fontSize: 12 }}>{UNAVAILABLE_HINT[channel]}</Text>}
          </Pressable>
        );
      })}
      {primary && fallbacks.length > 0 && (
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
