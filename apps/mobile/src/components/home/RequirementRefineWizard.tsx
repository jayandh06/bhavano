import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import type { Area, RefineRequirementInput, RequirementDto } from "@bhavano/types";
import { areaUnitShortLabel, convertArea, type AreaUnit } from "@bhavano/types/areaUnit";
import { bedroomLabel } from "@bhavano/types/bedrooms";
import { formatInrInWords } from "@bhavano/types/priceWords";
import {
  INTENT_CATEGORIES,
  INTENT_TRANSACTION_CHOICES,
  MAX_REQUIREMENT_AREAS,
  REQUIREMENT_ATTRIBUTE_QUESTIONS,
  REQUIREMENT_BEDROOM_OPTIONS,
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_INTENTS,
  REQUIREMENT_TIMELINE_OPTIONS,
  amenityOptionsFor,
  answeredSteps,
  applicableSteps,
  applyIntent,
  budgetPresetsFor,
  formatRequirementLabel,
  intentOf,
  sanitizeRequirementAttributes,
  sizeQuestionFor,
  type RequirementCriteria,
  type RequirementStep,
} from "@bhavano/types/requirementQuestions";
import { useAppTheme } from "../../theme/ThemeContext";
import { refineMyRequirement } from "../../lib/bffClient";
import { useAreasQuery } from "../../lib/queries";
import { useTabBarHeight } from "../../lib/tabBarHeight";

type WizardStep = RequirementStep | "review";
type Colors = ReturnType<typeof useAppTheme>["colors"];

const STEP_TITLES: Record<WizardStep, string> = {
  intent: "What are you looking for?",
  category: "What type of property?",
  details: "A few specifics",
  areas: "Which areas?",
  budget: "What's your budget?",
  amenities: "Any must-haves?",
  timeline: "When do you need it?",
  review: "Does this look right?",
};

const STEP_LINK_LABELS: Record<RequirementStep, string> = {
  intent: "what",
  category: "type",
  details: "specifics",
  areas: "areas",
  budget: "budget",
  amenities: "must-haves",
  timeline: "timeline",
};

/** How far a suggested area may be from one already picked. */
const NEARBY_KM = 6;

/** Same breakpoint as the home screen's two-column grid: at or above it this is a tablet. */
const WIDE_SCREEN_BREAKPOINT = 700;

function criteriaOf(r: RequirementDto): RequirementCriteria {
  return {
    category: r.category,
    transactionType: r.transactionType,
    cityId: r.cityId,
    areaIds: r.areaIds,
    bedroomOptions: r.bedroomOptions,
    minPrice: r.minPrice,
    maxPrice: r.maxPrice,
    minAreaSqft: r.minAreaSqft,
    maxAreaSqft: r.maxAreaSqft,
    areaUnit: r.areaUnit,
    attributes: r.attributes,
    moveInBy: r.moveInBy,
  };
}

function distanceKm(a: Area, b: Area): number {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return Infinity;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function parseAmount(raw: string): number | undefined {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

function parseSize(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}

function toUnit(sqft: number | undefined, unit: AreaUnit): string {
  return sqft === undefined ? "" : String(Math.round(convertArea(sqft, "sqft", unit) * 100) / 100);
}

function toggleIn(list: string[] | undefined, value: string, multi: boolean): string[] {
  const set = list ?? [];
  if (set.includes(value)) return set.filter((v) => v !== value);
  return multi ? [...set, value] : [value];
}

/**
 * Mobile counterpart to web's `RequirementRefineWizard` — the questions asked after "Yes, find
 * this for me", docs/plans/requirement-refinement-questions.md. Same steps, same skip rules and the
 * same per-step save, all from `@bhavano/types/requirementQuestions`, so the two apps can't drift
 * on what gets asked.
 *
 * Runs against a requirement that is already saved, and every step saves as it is answered, so
 * leaving halfway (the header's back, or Android's) keeps what was given. Steps the search already
 * answered are skipped — decided once, when this opens, so answering one question never makes
 * another vanish — and every step can be skipped.
 */
export function RequirementRefineWizard({
  requirement,
  accessToken,
  onFinished,
}: {
  requirement: RequirementDto;
  accessToken: string;
  /** Called with the saved requirement after the review step. */
  onFinished: (requirement: RequirementDto) => void;
}) {
  const { colors } = useAppTheme();
  const [current, setCurrent] = useState(requirement);
  const [draft, setDraft] = useState<RequirementCriteria>(() => criteriaOf(requirement));
  const skipped = useMemo(() => answeredSteps(criteriaOf(requirement)), [requirement]);
  const steps: WizardStep[] = [...applicableSteps(draft).filter((s) => !skipped.has(s)), "review"];
  const [stepKey, setStepKey] = useState<WizardStep>(steps[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: areas, isLoading: areasLoading } = useAreasQuery(requirement.cityId);
  const [areaQuery, setAreaQuery] = useState("");
  const [sizeUnit, setSizeUnit] = useState<AreaUnit>(requirement.areaUnit ?? "sqft");
  const [sizeMin, setSizeMin] = useState(() => toUnit(requirement.minAreaSqft, requirement.areaUnit ?? "sqft"));
  const [sizeMax, setSizeMax] = useState(() => toUnit(requirement.maxAreaSqft, requirement.areaUnit ?? "sqft"));
  const [budgetMin, setBudgetMin] = useState(requirement.minPrice?.toString() ?? "");
  const [budgetMax, setBudgetMax] = useState(requirement.maxPrice?.toString() ?? "");
  const [timeline, setTimeline] = useState<string | null>(null);
  const [note, setNote] = useState(requirement.note ?? "");

  // Keyboard handling, same pieces as the message composer (ConversationThread): the footer rides
  // on the keyboard via KeyboardStickyView, lifted by the keyboard height minus the always-mounted
  // tab bar the keyboard covers. The scroll view keeps a focused field clear of both the keyboard
  // and that footer, so its bottomOffset is the footer's measured height plus a margin.
  const tabBarHeight = useTabBarHeight();
  const { width } = useWindowDimensions();
  const gutter = width >= WIDE_SCREEN_BREAKPOINT ? 32 : 16;
  const [footerHeight, setFooterHeight] = useState(64);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  // The area search is the one field whose results render *below* it, so bringing just the input
  // above the keyboard leaves the matches hidden under it. Focusing it scrolls it to the top of the
  // screen instead. Re-run on keyboardDidShow, as FilterSheet does, because a scroll issued before
  // the keyboard has claimed its space gets undone.
  const areaSearchY = useRef({ section: 0, input: 0 });
  const areaSearchFocused = useRef(false);
  function scrollAreaSearchToTop() {
    const y = areaSearchY.current.section + areaSearchY.current.input;
    scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
  }
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (areaSearchFocused.current) scrollAreaSearchToTop();
    });
    return () => sub.remove();
  }, []);

  const intent = intentOf(draft.category, draft.transactionType);
  const areaById = useMemo(() => new Map((areas ?? []).map((a) => [a.id, a])), [areas]);
  const selectedAreaNames = (draft.areaIds ?? []).map(
    (id) => areaById.get(id)?.name ?? current.areaNames[current.areaIds.indexOf(id)] ?? "",
  );
  const position = steps.indexOf(stepKey);
  const cityName = current.cityName ?? "the city";

  function patchFor(step: WizardStep): RefineRequirementInput {
    const attributes = draft.category
      ? sanitizeRequirementAttributes(draft.category, draft.transactionType, draft.attributes ?? {}).attributes
      : undefined;
    switch (step) {
      case "intent":
      case "category":
        return { category: draft.category ?? null, transactionType: draft.transactionType ?? null };
      case "details": {
        const min = parseSize(sizeMin);
        const max = parseSize(sizeMax);
        return {
          bedroomOptions: draft.bedroomOptions ?? [],
          minAreaSqft: min === undefined ? null : Math.round(convertArea(min, sizeUnit, "sqft")),
          maxAreaSqft: max === undefined ? null : Math.round(convertArea(max, sizeUnit, "sqft")),
          areaUnit: min === undefined && max === undefined ? null : sizeUnit,
          attributes,
        };
      }
      case "areas":
        return { areaIds: draft.areaIds ?? [] };
      case "budget":
        return { minPrice: parseAmount(budgetMin) ?? null, maxPrice: parseAmount(budgetMax) ?? null };
      case "amenities":
        return { attributes };
      case "timeline": {
        const option = REQUIREMENT_TIMELINE_OPTIONS.find((o) => o.value === timeline);
        return {
          ...(option ? { moveInBy: option.days ? new Date(Date.now() + option.days * 86_400_000).toISOString() : null } : {}),
          note: note.trim() || null,
        };
      }
      case "review":
        return { complete: true };
    }
  }

  async function save(step: WizardStep): Promise<RequirementDto | null> {
    setSaving(true);
    setError(null);
    try {
      const saved = await refineMyRequirement(accessToken, current.id, patchFor(step));
      setCurrent(saved);
      setDraft(criteriaOf(saved));
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that — try again");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    // Recomputed from the latest draft: choosing Buy adds the property-type step, choosing PG
    // removes it. A step opened from the review's "Change" links may be one the search had
    // answered, so it is not in the sequence — it returns straight to the review.
    const next = [...applicableSteps(draft).filter((s) => !skipped.has(s)), "review" as const];
    const at = next.indexOf(stepKey);
    setStepKey(at === -1 ? "review" : (next[at + 1] ?? "review"));
  }

  async function saveAndNext() {
    if (stepKey === "review") {
      const saved = await save("review");
      if (saved) onFinished(saved);
      return;
    }
    if (await save(stepKey)) goNext();
  }

  function goBack() {
    if (position === -1) setStepKey("review");
    else if (position > 0) setStepKey(steps[position - 1]);
  }

  function setAttribute(key: string, values: string[]) {
    setDraft((d) => ({ ...d, attributes: { ...(d.attributes ?? {}), [key]: values } }));
  }

  // --- step bodies -------------------------------------------------------------------------

  function renderIntent() {
    const choices = intent ? INTENT_TRANSACTION_CHOICES[intent] : undefined;
    return (
      <>
        <ChipRow>
          {REQUIREMENT_INTENTS.map((option) => (
            <Chip
              key={option.value}
              colors={colors}
              active={intent === option.value}
              onPress={() => setDraft((d) => ({ ...d, ...applyIntent(option.value, d) }))}
              label={option.label}
            />
          ))}
        </ChipRow>
        {choices && (
          <View style={{ marginTop: 18 }}>
            <FieldLabel colors={colors}>{intent === "furniture" ? "Buy or rent?" : "Rent or lease?"}</FieldLabel>
            <ChipRow>
              {choices.map((option) => (
                <Chip
                  key={option.value}
                  colors={colors}
                  active={draft.transactionType === option.value}
                  onPress={() => setDraft((d) => ({ ...d, transactionType: option.value }))}
                  label={option.label}
                />
              ))}
            </ChipRow>
          </View>
        )}
      </>
    );
  }

  function renderCategory() {
    const options = intent ? INTENT_CATEGORIES[intent] : [];
    return (
      <ChipRow>
        {options.map((category) => (
          <Chip
            key={category}
            colors={colors}
            active={draft.category === category}
            onPress={() => setDraft((d) => ({ ...d, category }))}
            label={REQUIREMENT_CATEGORY_LABELS[category]}
          />
        ))}
      </ChipRow>
    );
  }

  function renderDetails() {
    if (!draft.category) return null;
    const size = sizeQuestionFor(draft.category);
    const questions = REQUIREMENT_ATTRIBUTE_QUESTIONS[draft.category].filter(
      (q) => !q.transactionTypes || (draft.transactionType && q.transactionTypes.includes(draft.transactionType)),
    );
    return (
      <View style={{ gap: 18 }}>
        {size?.kind === "bedrooms" && (
          <View>
            <FieldLabel colors={colors} hint="pick all that work">
              {size.label}
            </FieldLabel>
            <ChipRow>
              {REQUIREMENT_BEDROOM_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  colors={colors}
                  active={draft.bedroomOptions?.includes(n) ?? false}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      bedroomOptions: toggleIn(d.bedroomOptions?.map(String), String(n), true).map(Number),
                    }))
                  }
                  label={`${bedroomLabel(n)} BHK`}
                />
              ))}
            </ChipRow>
          </View>
        )}
        {size?.kind === "area" && (
          <View>
            <FieldLabel colors={colors}>{size.label}</FieldLabel>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={sizeMin}
                onChangeText={setSizeMin}
                keyboardType="decimal-pad"
                placeholder="Min"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Smallest size"
                style={[styles.input, styles.flexInput, inputColors(colors)]}
              />
              <Text style={{ color: colors.muted }}>to</Text>
              <TextInput
                value={sizeMax}
                onChangeText={setSizeMax}
                keyboardType="decimal-pad"
                placeholder="Max"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Largest size"
                style={[styles.input, styles.flexInput, inputColors(colors)]}
              />
            </View>
            {size.units.length > 1 ? (
              <View style={{ marginTop: 10 }}>
                <ChipRow>
                  {size.units.map((unit) => (
                    <Chip
                      key={unit}
                      colors={colors}
                      active={sizeUnit === unit}
                      onPress={() => setSizeUnit(unit)}
                      label={areaUnitShortLabel(unit, 2)}
                    />
                  ))}
                </ChipRow>
              </View>
            ) : (
              <Hint colors={colors}>In {areaUnitShortLabel(size.units[0], 2)}</Hint>
            )}
          </View>
        )}
        {questions.map((q) => (
          <View key={q.key}>
            <FieldLabel colors={colors} hint={q.multi ? "pick all that work" : undefined}>
              {q.label}
            </FieldLabel>
            <ChipRow>
              {q.options.map((option) => (
                <Chip
                  key={option.value}
                  colors={colors}
                  active={draft.attributes?.[q.key]?.includes(option.value) ?? false}
                  onPress={() => setAttribute(q.key, toggleIn(draft.attributes?.[q.key], option.value, q.multi))}
                  label={option.label}
                />
              ))}
            </ChipRow>
          </View>
        ))}
      </View>
    );
  }

  function renderAreas() {
    const selected = draft.areaIds ?? [];
    const full = selected.length >= MAX_REQUIREMENT_AREAS;
    const query = areaQuery.trim().toLowerCase();
    const matches = (areas ?? []).filter((a) => !selected.includes(a.id) && (!query || a.name.toLowerCase().includes(query)));
    const picked = selected.map((id) => areaById.get(id)).filter((a): a is Area => Boolean(a));
    const nearby = picked.length
      ? (areas ?? [])
          .filter((a) => !selected.includes(a.id))
          .map((a) => ({ area: a, km: Math.min(...picked.map((p) => distanceKm(p, a))) }))
          .filter((x) => x.km <= NEARBY_KM)
          .sort((x, y) => x.km - y.km)
          .slice(0, 5)
          .map((x) => x.area)
      : [];
    const toggle = (id: string) =>
      setDraft((d) => ({ ...d, areaIds: toggleIn(d.areaIds, id, true).slice(0, MAX_REQUIREMENT_AREAS) }));

    return (
      <View
        style={{ gap: 14 }}
        onLayout={(e) => {
          areaSearchY.current.section = e.nativeEvent.layout.y;
        }}
      >
        <Hint colors={colors}>
          Pick up to {MAX_REQUIREMENT_AREAS}. Owners and agents respond when you name the areas you&rsquo;d actually
          live in.
        </Hint>
        {selected.length > 0 && (
          <ChipRow>
            {selected.map((id, i) => (
              <Chip key={id} colors={colors} active onPress={() => toggle(id)} label={`${selectedAreaNames[i] || "Area"}  ✕`} />
            ))}
          </ChipRow>
        )}
        {nearby.length > 0 && !full && (
          <View>
            <FieldLabel colors={colors}>Also consider nearby</FieldLabel>
            <ChipRow>
              {nearby.map((a) => (
                <Chip key={a.id} colors={colors} active={false} onPress={() => toggle(a.id)} label={`+ ${a.name}`} />
              ))}
            </ChipRow>
          </View>
        )}
        {!full && (
          <>
            <TextInput
              value={areaQuery}
              onChangeText={setAreaQuery}
              placeholder={`Search areas in ${cityName}`}
              placeholderTextColor={colors.muted}
              onLayout={(e) => {
                areaSearchY.current.input = e.nativeEvent.layout.y;
              }}
              onFocus={() => {
                areaSearchFocused.current = true;
                scrollAreaSearchToTop();
              }}
              onBlur={() => {
                areaSearchFocused.current = false;
              }}
              style={[styles.input, inputColors(colors)]}
            />
            {areasLoading ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              // Rows rather than chips, for the same reason as FilterSheet's area checklist: a city
              // can have a hundred areas, and a wrapped chip grid of them is unscannable.
              <View style={[styles.areaList, { borderColor: colors.border }]}>
                {matches.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 12.5, padding: 12 }}>No area by that name.</Text>
                ) : (
                  matches.slice(0, 40).map((a, i) => (
                    <Pressable
                      key={a.id}
                      onPress={() => toggle(a.id)}
                      style={[styles.areaRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                    >
                      <Text style={{ fontSize: 13.5, color: colors.text, flex: 1 }}>{a.name}</Text>
                      <Text style={{ color: colors.green, fontSize: 15, fontWeight: "700" }}>+</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </View>
    );
  }

  function renderBudget() {
    const { unit, presets } = budgetPresetsFor(draft.category, draft.transactionType);
    const min = parseAmount(budgetMin);
    const max = parseAmount(budgetMax);
    return (
      <View style={{ gap: 14 }}>
        <Hint colors={colors}>In rupees, {unit}.</Hint>
        <ChipRow>
          {presets.map((p) => (
            <Chip
              key={p.label}
              colors={colors}
              active={min === p.min && max === p.max}
              onPress={() => {
                setBudgetMin(p.min?.toString() ?? "");
                setBudgetMax(p.max?.toString() ?? "");
              }}
              label={p.label}
            />
          ))}
        </ChipRow>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <FieldLabel colors={colors}>From ₹</FieldLabel>
            <TextInput
              value={budgetMin}
              onChangeText={(t) => setBudgetMin(t.replace(/\D/g, ""))}
              keyboardType="numeric"
              style={[styles.input, inputColors(colors)]}
            />
            {min !== undefined && <Hint colors={colors}>{formatInrInWords(min)}</Hint>}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <FieldLabel colors={colors}>Up to ₹</FieldLabel>
            <TextInput
              value={budgetMax}
              onChangeText={(t) => setBudgetMax(t.replace(/\D/g, ""))}
              keyboardType="numeric"
              style={[styles.input, inputColors(colors)]}
            />
            {max !== undefined && <Hint colors={colors}>{formatInrInWords(max)}</Hint>}
          </View>
        </View>
      </View>
    );
  }

  function renderAmenities() {
    if (!draft.category) return null;
    return (
      <ChipRow>
        {amenityOptionsFor(draft.category).map((option) => (
          <Chip
            key={option.value}
            colors={colors}
            active={draft.attributes?.amenities?.includes(option.value) ?? false}
            onPress={() => setAttribute("amenities", toggleIn(draft.attributes?.amenities, option.value, true))}
            label={option.label}
          />
        ))}
      </ChipRow>
    );
  }

  function renderTimeline() {
    return (
      <View style={{ gap: 14 }}>
        <ChipRow>
          {REQUIREMENT_TIMELINE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              colors={colors}
              active={timeline === option.value}
              onPress={() => setTimeline(option.value)}
              label={option.label}
            />
          ))}
        </ChipRow>
        {timeline === null && current.moveInBy && (
          <Hint colors={colors}>
            Currently: needed by{" "}
            {new Date(current.moveInBy).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </Hint>
        )}
        <View style={{ gap: 6 }}>
          <FieldLabel colors={colors}>Anything else? (optional)</FieldLabel>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            placeholder="Near a metro station, ground floor, pet friendly…"
            placeholderTextColor={colors.muted}
            style={[styles.input, inputColors(colors), { minHeight: 70, textAlignVertical: "top" }]}
          />
        </View>
      </View>
    );
  }

  function renderReview() {
    const label = formatRequirementLabel(draft, { cityName: current.cityName, areaNames: selectedAreaNames.filter(Boolean) });
    return (
      <View style={{ gap: 14 }}>
        <View style={[styles.labelBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{label}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {applicableSteps(draft).map((step) => (
            <Pressable key={step} onPress={() => setStepKey(step)} hitSlop={6}>
              <Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: "underline" }}>
                Change {STEP_LINK_LABELS[step]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Hint colors={colors}>
          {current.contactConsent
            ? "Owners and agents with a matching property may call or message you."
            : "Only Bhavano will contact you — your number stays with us."}
        </Hint>
      </View>
    );
  }

  const body: Record<WizardStep, () => ReactNode> = {
    intent: renderIntent,
    category: renderCategory,
    details: renderDetails,
    areas: renderAreas,
    budget: renderBudget,
    amenities: renderAmenities,
    timeline: renderTimeline,
    review: renderReview,
  };

  return (
    <View style={{ flex: 1, width: "100%" }}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        bottomOffset={footerHeight + 16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 32 }}
      >
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.4 }}>
          {stepKey === "review" ? "REVIEW" : position === -1 ? "EDIT" : `STEP ${position + 1} OF ${steps.length - 1}`}
        </Text>
        <Text style={{ fontFamily: "serif", fontSize: 19, fontWeight: "700", color: colors.text, marginTop: 4, marginBottom: 16 }}>
          {stepKey === "areas" ? `Which areas of ${cityName}?` : STEP_TITLES[stepKey]}
        </Text>
        {body[stepKey]()}
        {error && <Text style={{ color: "#c0554b", fontSize: 12.5, marginTop: 14 }}>{error}</Text>}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: tabBarHeight }}>
      <View
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        style={[styles.footer, { paddingHorizontal: gutter, borderTopColor: colors.border, backgroundColor: colors.bg }]}
      >
        {position !== 0 && (
          <Pressable onPress={goBack} disabled={saving} hitSlop={8}>
            <Text style={{ color: colors.muted, fontSize: 13.5, textDecorationLine: "underline" }}>Back</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {stepKey !== "review" && (
          <Pressable onPress={goNext} disabled={saving} hitSlop={8} style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 13.5, textDecorationLine: "underline" }} numberOfLines={1}>
              {stepKey === "areas" ? `Anywhere in ${cityName}` : "Skip"}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => void saveAndNext()}
          disabled={saving}
          style={[styles.primaryButton, { backgroundColor: colors.green, opacity: saving ? 0.6 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>
              {stepKey === "review" ? "Done" : "Next"}
            </Text>
          )}
        </Pressable>
      </View>
      </KeyboardStickyView>
    </View>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.wrapRow}>{children}</View>;
}

function Chip({ colors, active, onPress, label }: { colors: Colors; active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.surfaceAlt : colors.surface, borderColor: active ? colors.green : colors.border },
      ]}
    >
      <Text style={{ fontSize: 13, color: active ? colors.green : colors.text, fontWeight: active ? "700" : "400" }}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ colors, hint, children }: { colors: Colors; hint?: string; children: ReactNode }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 8 }}>
      {children}
      {hint ? <Text style={{ fontWeight: "400" }}> · {hint}</Text> : null}
    </Text>
  );
}

function Hint({ colors, children }: { colors: Colors; children: ReactNode }) {
  return <Text style={{ fontSize: 12.5, color: colors.muted }}>{children}</Text>;
}

function inputColors(colors: Colors) {
  return { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface };
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14 },
  flexInput: { flex: 1 },
  areaList: { borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  areaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 12 },
  labelBox: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  primaryButton: { borderRadius: 8, paddingVertical: 11, paddingHorizontal: 22, minWidth: 90, alignItems: "center" },
});
