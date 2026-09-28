import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { RequirementDto } from "@bhavano/types";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { BffError, fetchMyRequirement } from "../../../src/lib/bffClient";
import { ScreenHeader } from "../../../src/components/home/ScreenHeader";
import { RequirementRefineWizard } from "../../../src/components/home/RequirementRefineWizard";

/**
 * The refinement questions — docs/plans/requirement-refinement-questions.md, Phase B. A pushed
 * route rather than a bottom sheet: it survives backgrounding, gets the keyboard handling for the
 * custom budget for free, and can be deep-linked from a reminder. Opened by `RequirementPrompt`
 * right after a capture and by "Finish details" on /my-requirements.
 */
export default function RefineRequirementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken, isLoggedIn, requireLogin } = useHomeSheets();
  const [requirement, setRequirement] = useState<RequirementDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every answer is already saved, so leaving is never losing anything. A deep link has no screen
  // underneath to go back to.
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/my-requirements");
  }, [router]);

  useEffect(() => {
    if (!isLoggedIn || !accessToken) {
      requireLogin();
      return;
    }
    let cancelled = false;
    fetchMyRequirement(accessToken, id)
      .then((r) => {
        if (!cancelled) setRequirement(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof BffError && (e.status === 401 || e.status === 403)) {
          requireLogin();
          return;
        }
        setError(
          e instanceof BffError && e.status === 404
            ? "This requirement couldn't be found."
            : e instanceof Error
              ? e.message
              : "Couldn't load this requirement",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id, isLoggedIn, requireLogin]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Tell us more" onBack={leave} />
      {error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>{error}</Text>
        </View>
      ) : !requirement || !accessToken ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : !requirement.canRefine ? (
        // Past the edit window: our team has already acted on it, owners were already told, or it
        // is no longer open — changing the criteria underneath any of those would mislead someone.
        <View style={styles.centered}>
          <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>
            {requirement.searchLabel}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", marginTop: 8, marginBottom: 16 }}>
            This requirement can&rsquo;t be changed any more — it&rsquo;s already being worked on, or it&rsquo;s no longer
            active. You can still add a note to it, or start a new search.
          </Text>
          <Pressable onPress={() => router.replace("/my-requirements")}>
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Your requirements</Text>
          </Pressable>
        </View>
      ) : (
        <RequirementRefineWizard
          requirement={requirement}
          mode={{ kind: "refine", id: requirement.id, accessToken }}
          onFinished={leave}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
});
