import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
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
 * `criteria` comes from the screen's own resolved filters, same as web — nothing to re-enter.
 */
export function RequirementPrompt({
  criteria,
  label,
}: {
  criteria: Omit<CreateRequirementInput, "searchLabel">;
  label: string;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { requireLogin, accessToken } = useHomeSheets();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [hasAlert, setHasAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const requirement = await createRequirement(accessToken, { ...criteria, searchLabel: label });
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
            ? "Noted — we'll message you as soon as something matching is posted."
            : "Noted — our team will look into what's available and get back to you."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 17, color: colors.text, textAlign: "center" }}>
        Nothing matching {label} right now
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 18 }}>
        Tell us what you're looking for and we'll go find it — you don't have to keep checking back.
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
        <Pressable
          onPress={() => void submit()}
          disabled={state === "saving"}
          style={[styles.primaryButton, { backgroundColor: colors.green, opacity: state === "saving" ? 0.6 : 1 }]}
        >
          {state === "saving" ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5 }}>Tell us what you need</Text>
          )}
        </Pressable>
        {/* The other half of an empty result: whoever is reading this may be the person who could
          * fill it — same reasoning as web's postAdHref. */}
        <Pressable onPress={() => router.push("/post")} style={[styles.secondaryButton, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13.5 }}>Post an ad</Text>
        </Pressable>
      </View>
      {error && <Text style={{ color: "#c0554b", fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</Text>}
      <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "center", marginTop: 14 }}>
        Or adjust the filters above to widen the search.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 32, borderWidth: 1, borderRadius: 14, padding: 22 },
  primaryButton: { borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20 },
  secondaryButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20 },
});
