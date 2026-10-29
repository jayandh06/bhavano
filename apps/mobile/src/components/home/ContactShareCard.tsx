import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ContactSharePreferenceDto } from "@bhavano/types/seekerContact";
import { useAppTheme } from "../../theme/ThemeContext";
import { fetchContactShare, saveContactShare } from "../../lib/bffClient";

/** Account card: may owners of Featured ads this person shows interest in see their number. Only shown while an admin has the feature on. In notice mode it starts on
 * (and this is how to opt out); in opt-in mode it starts off. See docs/plans/featured-seeker-contact-for-owners.md. */
export function ContactShareCard({ accessToken }: { accessToken: string }) {
  const { colors } = useAppTheme();
  const [preference, setPreference] = useState<ContactSharePreferenceDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchContactShare(accessToken)
      .then((p) => {
        if (!cancelled) setPreference(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!preference?.enabled) return null;

  async function toggle() {
    if (!preference || saving) return;
    setSaving(true);
    setError(null);
    try {
      setPreference(await saveContactShare(accessToken, !preference.sharing));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginTop: 14 }}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Who can call you</Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
        When you show interest in an ad, its owner can see your verified mobile number if their ad is Featured, or if they unlock it. You can turn that off any time.
      </Text>
      <Pressable onPress={() => void toggle()} disabled={saving} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: saving ? 0.6 : 1 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: colors.green,
            backgroundColor: preference.sharing ? colors.green : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {preference.sharing ? <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>Let owners of ads I show interest in call me</Text>
      </Pressable>
      {error ? <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{error}</Text> : null}
    </View>
  );
}
