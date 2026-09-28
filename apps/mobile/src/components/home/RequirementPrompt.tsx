import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { RequirementCaptureCriteria, RequirementDto } from "@bhavano/types";
import { formatRequirementLabel } from "@bhavano/types/requirementQuestions";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { startRequirementDraft, takeCreatedRequirement } from "../../lib/requirementDraft";
import { Icon } from "../Icon";
import { RequirementCityPicker, type PickedCity } from "./RequirementCityPicker";

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
 * the card states them back and asks whether owners and agents with a matching property may
 * contact them directly. "Yes" opens the questions for whatever the search didn't answer, and the
 * requirement is created at the end with every answer — never half-filled
 * (docs/plans/requirement-refinement-questions.md).
 */
export function RequirementPrompt({
  criteria,
  label,
  cityName,
}: {
  /** Without a `cityId` (no city picked on the home screen) the card asks for one first. */
  criteria: RequirementCaptureCriteria;
  label: string;
  /** The home screen's city, for the questions ("Which areas of Chennai?"). */
  cityName?: string;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { requireLogin, accessToken } = useHomeSheets();
  const [saved, setSaved] = useState<RequirementDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coming back from the questions: they hand over the requirement they created, if they got to
  // the end.
  useFocusEffect(
    useCallback(() => {
      const created = takeCreatedRequirement();
      if (created) setSaved(created);
    }, []),
  );
  /** On by default, same as web: someone asking us to go and find a house generally does want the
   * person who has one to ring them, and the toggle is right there. */
  const [allowContact, setAllowContact] = useState(true);
  /** A requirement for "anywhere in India" is not one anybody can act on — same rule as web. */
  const needsCity = !criteria.cityId;
  const [city, setCity] = useState<PickedCity | undefined>(undefined);
  const cityId = criteria.cityId ?? city?.id;
  const shownLabel = needsCity && city ? formatRequirementLabel({ ...criteria, cityId: city.id }, { cityName: city.name }) : label;

  /** Login comes before the questions, so the create at the end of them can't be the thing that
   * sends someone off to sign in. */
  function start() {
    if (!cityId) {
      setError("Pick a city first");
      return;
    }
    if (!accessToken) {
      // Resumes straight into the questions once login completes, rather than making the seeker
      // tap the button again — same pattern as ListingCard's onMessage/onViewContact.
      requireLogin({ onSuccess: start });
      return;
    }
    setError(null);
    startRequirementDraft({
      criteria: { ...criteria, cityId },
      label: shownLabel,
      cityName: criteria.cityId ? cityName : city?.name,
      contactConsent: allowContact,
    });
    router.push("/requirement/new");
  }

  if (saved) {
    return (
      <View style={[styles.card, { borderColor: colors.green, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5, textAlign: "center" }}>
          {saved.hasAlert
            ? "Confirmed — we'll message you as soon as something matching is posted."
            : "Confirmed — our team will look into what's available and get back to you."}
        </Text>
        <View style={[styles.criteria, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, marginTop: 10 }]}>
          <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>
            {saved.searchLabel}
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", marginTop: 6 }}>
          {saved.contactConsent
            ? "Owners and agents with a matching property can get in touch with you directly."
            : "Only Bhavano will contact you — your number stays with us."}
        </Text>
        <Pressable
          onPress={() => router.push("/my-requirements")}
          style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }}
        >
          <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", textDecorationLine: "underline" }}>
            See your requirements
          </Text>
          <Icon name="chevronRight" size={12} color={colors.muted} />
        </Pressable>
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
        There's nothing matching right now. Answer a few quick questions and we'll go looking — you
        don't have to keep checking back.
      </Text>
      {/* The criteria, stated back — the thing being confirmed. The questions that follow fill in
        * what it doesn't say. */}
      <View style={[styles.criteria, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{shownLabel}</Text>
      </View>
      {needsCity && (
        <View style={{ marginTop: 14, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Which city?</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
            Nobody can find you a place anywhere in India — start with the city, and we'll ask which areas next.
          </Text>
          <RequirementCityPicker value={city} onChange={setCity} />
        </View>
      )}
      <View style={styles.consentRow}>
        <Switch value={allowContact} onValueChange={setAllowContact} />
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
        onPress={start}
        disabled={!cityId}
        style={[styles.primaryButton, { backgroundColor: colors.green, opacity: !cityId ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5, textAlign: "center" }}>
          Yes, find this for me
        </Text>
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
