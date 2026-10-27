import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  effectiveOwnerAlertChannel,
  isPaidOwnerAlertChannel,
  OWNER_ALERT_CHANNEL_LABELS,
  OWNER_ALERT_CHANNELS,
  withPrimaryChannel,
  type OwnerAlertChannel,
} from "@bhavano/types/ownerAlerts";
import { useAppTheme } from "../../theme/ThemeContext";
import { useAlertPreferencesQuery } from "../../lib/queries";
import { Icon } from "../Icon";

export interface AlertChannelChoice {
  /** False blocks posting: no channel can reach the owner for this ad and they have not said they will check Messages themselves. */
  ready: boolean;
  primary: OwnerAlertChannel | null;
}

const UNAVAILABLE_HINT: Record<OwnerAlertChannel, string> = {
  push: "Turn on notifications for Bhavano to use this",
  whatsapp: "Add your phone number to use this",
  sms: "Add your phone number to use this",
  email: "Add and verify your email in your profile to use this",
};

/** The required "how should we alert you?" answer on the Preview step, just above Post. Push and email are free; WhatsApp and SMS belong to Featured ads
 * and unlock when a Featured plan is picked on this page. Pre-filled with the best free channel, so it is a confirmation rather than a chore; it blocks
 * posting only when nothing can reach the owner until they say they will check Messages themselves, add an email, or go Featured. Mirrors the web
 * wizard's AlertChannelPicker. */
export function AlertChannelPicker({
  accessToken,
  featured,
  featuredSelectable,
  onChange,
}: {
  accessToken: string;
  featured: boolean;
  /** The Featured plan picker is on this same page (an admin setting); otherwise Featured is offered right after posting. */
  featuredSelectable: boolean;
  onChange: (choice: AlertChannelChoice) => void;
}) {
  const { colors } = useAppTheme();
  const { data: pref } = useAlertPreferencesQuery(accessToken);
  const [picked, setPicked] = useState<OwnerAlertChannel | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [checkMyself, setCheckMyself] = useState(false);

  useEffect(() => {
    if (!pref || initialised) return;
    setInitialised(true);
    setPicked(pref.confirmed ? pref.channels[0] : pref.available.push ? "push" : pref.available.email ? "email" : null);
  }, [pref, initialised]);

  const order = useMemo(() => (pref ? withPrimaryChannel(pref.channels, picked ?? pref.channels[0]) : []), [pref, picked]);
  const effective = pref ? effectiveOwnerAlertChannel(order, pref.available, featured) : null;
  const ready = !pref || effective !== null || checkMyself;

  useEffect(() => {
    onChange({ ready, primary: pref ? (picked ?? (checkMyself ? "push" : null)) : null });
  }, [ready, picked, checkMyself, pref, onChange]);

  if (!pref) return null;

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {!pref.available.push && (
        <View style={{ borderWidth: 1, borderColor: `${colors.green}66`, backgroundColor: `${colors.green}1a`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
            Turn on notifications to get instant alerts and reply to seekers right away
          </Text>
          <Text style={{ color: colors.textSoft, fontSize: 12, marginTop: 2 }}>
            Seekers move on quickly. Allow Bhavano notifications in your phone settings and you are told the moment someone writes, views your number or shows interest.
          </Text>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name="bell" size={15} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700", flexShrink: 1 }}>
          How should we alert you when someone contacts you?
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
        Mobile App notifications and email are free. WhatsApp and SMS are included with Featured ads.
      </Text>
      {OWNER_ALERT_CHANNELS.map((channel) => {
        const paid = isPaidOwnerAlertChannel(channel);
        const reachable = pref.available[channel];
        const locked = paid && !featured;
        // A paid channel can be chosen before the ad is Featured: it takes over once it is, and the free channels cover the time until then.
        const usable = reachable;
        const selected = picked === channel;
        return (
          <Pressable
            key={channel}
            disabled={!usable}
            onPress={() => setPicked(channel)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !usable }}
            style={[styles.option, { borderColor: selected ? colors.green : colors.border, opacity: usable ? 1 : 0.55 }]}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              {OWNER_ALERT_CHANNEL_LABELS[channel]}
              <Text style={{ color: colors.muted, fontWeight: "400" }}>
                {paid ? "  Featured" : channel === "push" ? " (free, fastest)" : " (free)"}
              </Text>
            </Text>
            {!reachable ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>{UNAVAILABLE_HINT[channel]}</Text>
            ) : locked ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {featuredSelectable
                  ? "Choose a Featured plan above to alert you here"
                  : "Included with Featured ads. You can make this ad Featured right after posting."}
                {selected && effective && effective !== channel ? ` Until then we'll use ${OWNER_ALERT_CHANNEL_LABELS[effective]}.` : ""}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {!effective && (
        <Pressable
          onPress={() => setCheckMyself((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: checkMyself }}
          style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "flex-start" }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: colors.green,
              backgroundColor: checkMyself ? colors.green : "transparent",
            }}
          />
          <Text style={{ color: colors.textSoft, fontSize: 13, flex: 1 }}>
            None of these can reach me right now. I&apos;ll check Messages on Bhavano myself (or choose a Featured plan for WhatsApp and SMS alerts).
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  option: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
});
