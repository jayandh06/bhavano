import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { RequirementAnswers, RequirementDto } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { BffError, createRequirement } from "../../src/lib/bffClient";
import { finishRequirementDraft, pendingRequirementDraft } from "../../src/lib/requirementDraft";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import {
  RequirementRefineWizard,
  type RequirementWizardSubject,
} from "../../src/components/home/RequirementRefineWizard";

/**
 * The requirement questions for a new capture — docs/plans/requirement-refinement-questions.md.
 * Opened by `RequirementPrompt` after "Yes, find this for me". Nothing is saved until the last
 * step, which creates the requirement with every answer, so leaving early leaves nothing behind.
 */
export default function NewRequirementScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken, requireLogin } = useHomeSheets();
  const [draft] = useState(pendingRequirementDraft);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  async function create(answers: RequirementAnswers): Promise<RequirementDto> {
    if (!draft) throw new Error("Go back and start again.");
    if (!accessToken) {
      requireLogin();
      throw new Error("You were signed out — sign in, then press the button again.");
    }
    try {
      return await createRequirement(accessToken, {
        ...answers,
        searchLabel: draft.label,
        landingPath: draft.criteria.landingPath,
        contactConsent: draft.contactConsent,
      });
    } catch (e) {
      throw new Error(e instanceof BffError ? e.userMessage : "Couldn't save that — try again");
    }
  }

  const subject: RequirementWizardSubject | null = draft && {
    category: draft.criteria.category,
    transactionType: draft.criteria.transactionType,
    cityId: draft.criteria.cityId,
    cityName: draft.cityName,
    areaIds: draft.criteria.areaIds ?? (draft.criteria.areaId ? [draft.criteria.areaId] : []),
    areaNames: [],
    bedroomOptions: draft.criteria.bedroomOptions ?? (draft.criteria.bedrooms ? [draft.criteria.bedrooms] : []),
    minPrice: draft.criteria.minPrice,
    maxPrice: draft.criteria.maxPrice,
    minAreaSqft: draft.criteria.minAreaSqft,
    maxAreaSqft: draft.criteria.maxAreaSqft,
    areaUnit: draft.criteria.areaUnit,
    attributes: draft.criteria.attributes ?? {},
    moveInBy: draft.criteria.moveInBy,
    note: draft.criteria.note,
    contactConsent: draft.contactConsent,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Tell us more" onBack={leave} />
      {subject ? (
        <RequirementRefineWizard
          requirement={subject}
          mode={{ kind: "create", create }}
          onFinished={(requirement) => {
            finishRequirementDraft(requirement);
            leave();
          }}
        />
      ) : (
        // The app was restarted mid-way, or this was opened directly: there is no search to
        // start from.
        <View style={styles.centered}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: 16 }}>
            Start from a search that found nothing, and we&rsquo;ll ask what you need.
          </Text>
          <Pressable onPress={leave}>
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Go back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
});
