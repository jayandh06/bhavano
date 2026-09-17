import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { CreateRequirementInput } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { createRequirement } from "../../lib/bffClient";

/**
 * Mobile counterpart to the web wizard's `RequirementPrompt` (`apps/web/src/components/home/
 * RequirementPrompt.tsx`) — same "empty" variant only (the zero-results card), not the "inline"
 * one shown below real results, since the home screen's `FlatList` has nowhere natural to render
 * a footer-like prompt underneath results the way a web page's scroll does. See
 * docs/plans/property-requirements-demand-side.md for why this exists: a dead-end search is the
 * highest-intent moment on the site, and until now the mobile home screen didn't even show a
 * plain "no results" message for it — see `(tabs)/index.tsx`'s `FlatList`, which had no
 * `ListEmptyComponent` at all.
 *
 * `criteria` comes from the screen's own resolved filters, same as web — nothing to re-enter, so
 * the card states them back and asks for a confirmation rather than presenting a form. The one
 * thing it does ask is the one thing the search cannot tell us: whether owners and agents with a
 * matching property may contact them directly.
 */
export function RequirementPrompt({
  criteria,
  label,
}: {
  criteria: Omit<CreateRequirementInput, "searchLabel">;
  label: string;
}) {
  const { colors } = useAppTheme();
  const { requireLogin, accessToken } = useHomeSheets();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [hasAlert, setHasAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** On by default, same as web: someone asking us to go and find a house generally does want the
   * person who has one to ring them, and the toggle is right there. */
  const [allowContact, setAllowContact] = useState(true);

  async function submit() {
    if (!accessToken) {
      // Resumes straight into the save once login completes, rather than making the seeker tap
      // the button again — same pattern as ListingCard's onMessage/onViewContact.
      requireLogin({ onSuccess: () => void submit() });
      return;
    }
    setState("saving");
    setError(null);
    try {
      const requirement = await createRequirement(accessToken, {
        ...criteria,
        searchLabel: label,
        contactConsent: allowContact,
      });
      setHasAlert(requirement.hasAlert);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that just now");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <View style={[styles.card, { borderColor: colors.green, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5, textAlign: "center" }}>
          {hasAlert
            ? "Confirmed — we'll message you as soon as something matching is posted."
            : "Confirmed — our team will look into what's available and get back to you."}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", marginTop: 6 }}>
          {allowContact
            ? "Owners and agents with a matching property can get in touch with you directly."
            : "Only Bhavano will contact you — your number stays with us."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {/* A question, not an announcement: the old copy told them their search had failed and then
        * asked them to "tell us what you need" — which they just had, by searching. */}
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 17, color: colors.text, textAlign: "center" }}>
        Shall we find this for you?
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 14 }}>
        There's nothing matching right now. Confirm below and we'll go looking — you don't have to
        keep checking back.
      </Text>
      {/* The criteria, stated back — this is the thing being confirmed, and it is verbatim what
        * gets stored as `searchLabel`. */}
      <View style={[styles.criteria, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      </View>
      <View style={styles.consentRow}>
        <Switch value={allowContact} onValueChange={setAllowContact} disabled={state === "saving"} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>
            Owners and agents with a matching property may call or message me.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Turn this off and only Bhavano will contact you.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => void submit()}
        disabled={state === "saving"}
        style={[styles.primaryButton, { backgroundColor: colors.green, opacity: state === "saving" ? 0.6 : 1 }]}
      >
        {state === "saving" ? (
          <ActivityIndicator color={colors.onGreen} />
        ) : (
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5, textAlign: "center" }}>
            Yes, find this for me
          </Text>
        )}
      </Pressable>
      {error && <Text style={{ color: "#c0554b", fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</Text>}
      <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "center", marginTop: 14 }}>
        Or adjust the filters above to widen the search.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 32, borderWidth: 1, borderRadius: 14, padding: 22 },
  primaryButton: { borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20, marginTop: 14 },
  criteria: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14 },
});
