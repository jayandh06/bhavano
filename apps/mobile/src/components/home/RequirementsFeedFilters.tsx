import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { bedroomLabel } from "@bhavano/types/bedrooms";
import {
  type RequirementFeedDto,
  type RequirementFeedFilters as Filters,
  type RequirementFeedMoveIn,
} from "@bhavano/types/requirementFeed";
import {
  INTENT_CATEGORIES,
  INTENT_TRANSACTION_CHOICES,
  REQUIREMENT_ATTRIBUTE_QUESTIONS,
  REQUIREMENT_BEDROOM_OPTIONS,
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_INTENTS,
  amenityOptionsFor,
  budgetPresetsFor,
  sizeQuestionFor,
  type RequirementIntent,
} from "@bhavano/types/requirementQuestions";
import { useAppTheme } from "../../theme/ThemeContext";

/** Plot / commercial / storage size bands — not exported from the shared package (web keeps its
 * own copy inline in RequirementsFeedPage.tsx too), so this is this file's own copy of the same
 * bands rather than a cross-file import of a page component. */
const SIZE_PRESETS: Partial<Record<ListingCategory, { label: string; min?: number; max?: number }[]>> = {
  plot: [
    { label: "Under 1,200 sqft", max: 1200 },
    { label: "1,200–2,400 sqft", min: 1200, max: 2400 },
    { label: "2,400–5,000 sqft", min: 2400, max: 5000 },
    { label: "5,000+ sqft", min: 5000 },
  ],
  commercial: [
    { label: "Under 500 sqft", max: 500 },
    { label: "500–1,500 sqft", min: 500, max: 1500 },
    { label: "1,500–5,000 sqft", min: 1500, max: 5000 },
    { label: "5,000+ sqft", min: 5000 },
  ],
  storage: [
    { label: "Under 100 sqft", max: 100 },
    { label: "100–500 sqft", min: 100, max: 500 },
    { label: "500+ sqft", min: 500 },
  ],
};

const MOVE_IN_OPTIONS: { value: RequirementFeedMoveIn; label: string }[] = [
  { value: "now", label: "Immediately" },
  { value: "month", label: "Within a month" },
  { value: "quarter", label: "In 1–3 months" },
  { value: "exploring", label: "Just exploring" },
];

/** A different intent means a different set of questions, so everything below it resets — same
 * rule as web's `withIntent`. */
function withIntent(f: Filters, intent: RequirementIntent | undefined): Filters {
  const { city, areas, postedWithinDays, moveIn, openToCalls, matchesMyListings, sort } = f;
  return { city, areas, postedWithinDays, moveIn, openToCalls, matchesMyListings, sort, intent };
}

function withTransaction(f: Filters, transactionType: TransactionType | undefined): Filters {
  return { ...f, transactionType, minBudget: undefined, maxBudget: undefined, attributes: undefined };
}

function withCategory(f: Filters, category: ListingCategory | undefined): Filters {
  return { ...f, category, bedrooms: undefined, minSqft: undefined, maxSqft: undefined, attributes: undefined, amenities: undefined };
}

function toggleItem<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
  return next.length ? next : undefined;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? colors.green : colors.border, backgroundColor: active ? `${colors.green}1a` : colors.surface },
      ]}
    >
      <Text style={{ fontSize: 12.5, fontWeight: active ? "700" : "500", color: active ? colors.green : colors.text }}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{title}</Text>
      <View style={styles.wrapRow}>{children}</View>
    </View>
  );
}

/**
 * Mobile counterpart to web's `FeedFilters` sidebar (RequirementsFeedPage.tsx) — same sections,
 * same order, as a staged-then-Apply bottom sheet (same pattern as the listings `FilterSheet`)
 * instead of web's plain links, since there's no URL here to drive the state from. `facets` comes
 * from the last loaded feed response (same as web, which only ever shows counts from the page it
 * last rendered, never recomputed live per keystroke).
 */
export const RequirementsFeedFilters = forwardRef<
  BottomSheetModal,
  {
    applied: Filters;
    facets: RequirementFeedDto["facets"];
    hasListings: boolean;
    onApply: (next: Filters) => void;
  }
>(function RequirementsFeedFilters({ applied, facets, hasListings, onApply }, ref) {
  const { colors } = useAppTheme();
  const [staged, setStaged] = useState<Filters>(applied);

  // Re-sync whenever the sheet reopens, so a dismiss-without-Apply never leaves stale edits —
  // same reasoning as the listings FilterSheet's identical effect.
  useEffect(() => {
    setStaged(applied);
  }, [applied]);

  const intent = staged.intent;
  const transactionChoices = intent ? INTENT_TRANSACTION_CHOICES[intent] : undefined;
  const transaction = staged.transactionType ?? (intent === "buy" ? "sell" : intent === "pg" ? "rent" : undefined);
  const categories = intent ? INTENT_CATEGORIES[intent] : [];
  const category = staged.category ?? (categories.length === 1 ? categories[0] : undefined);
  const showBudget = Boolean(intent && (!transactionChoices || staged.transactionType));
  const size = category ? sizeQuestionFor(category) : undefined;
  const questions = category
    ? REQUIREMENT_ATTRIBUTE_QUESTIONS[category].filter((q) => !q.transactionTypes || (transaction && q.transactionTypes.includes(transaction)))
    : [];
  const amenities = category ? amenityOptionsFor(category) : [];

  function reset() {
    setStaged({});
  }

  function apply() {
    onApply(staged);
  }

  return (
    <BottomSheetModal ref={ref} snapPoints={["85%"]} backgroundStyle={{ backgroundColor: colors.surface }}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Filters</Text>

        <Section title="CITY">
          <Chip label="All cities" active={!staged.city} onPress={() => setStaged((p) => ({ ...p, city: undefined, areas: undefined }))} />
          {facets.cities.map((c) => (
            <Chip
              key={c.cityId}
              label={`${c.cityName} (${c.count})`}
              active={staged.city === c.cityId}
              onPress={() => setStaged((p) => ({ ...p, city: c.cityId, areas: undefined }))}
            />
          ))}
        </Section>

        {staged.city && facets.areas.length > 0 && (
          <Section title="AREAS">
            {facets.areas.map((a) => (
              <Chip
                key={a.areaId}
                label={`${a.name} (${a.count})`}
                active={Boolean(staged.areas?.includes(a.areaId))}
                onPress={() => setStaged((p) => ({ ...p, areas: toggleItem(p.areas, a.areaId) }))}
              />
            ))}
          </Section>
        )}

        <Section title="LOOKING TO">
          <Chip label="Any" active={!intent} onPress={() => setStaged(withIntent(staged, undefined))} />
          {REQUIREMENT_INTENTS.map((i) => (
            <Chip
              key={i.value}
              label={`${i.label} (${facets.intents[i.value] ?? 0})`}
              active={intent === i.value}
              onPress={() => setStaged(withIntent(staged, i.value))}
            />
          ))}
        </Section>

        {transactionChoices && (
          <Section title="TRANSACTION">
            <Chip label="Any" active={!staged.transactionType} onPress={() => setStaged(withTransaction(staged, undefined))} />
            {transactionChoices.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                active={staged.transactionType === t.value}
                onPress={() => setStaged(withTransaction(staged, t.value))}
              />
            ))}
          </Section>
        )}

        {categories.length > 1 && (
          <Section title="PROPERTY TYPE">
            <Chip label="Any" active={!staged.category} onPress={() => setStaged(withCategory(staged, undefined))} />
            {categories.map((c) => (
              <Chip
                key={c}
                label={`${REQUIREMENT_CATEGORY_LABELS[c]} (${facets.categories[c] ?? 0})`}
                active={staged.category === c}
                onPress={() => setStaged(withCategory(staged, c))}
              />
            ))}
          </Section>
        )}

        {showBudget && (
          <Section title={`BUDGET (${budgetPresetsFor(category, transaction).unit.toUpperCase()})`}>
            {budgetPresetsFor(category, transaction).presets.map((p) => {
              const active = staged.minBudget === p.min && staged.maxBudget === p.max;
              return (
                <Chip
                  key={p.label}
                  label={p.label}
                  active={active}
                  onPress={() =>
                    setStaged((prev) =>
                      active
                        ? { ...prev, minBudget: undefined, maxBudget: undefined }
                        : { ...prev, minBudget: p.min, maxBudget: p.max },
                    )
                  }
                />
              );
            })}
          </Section>
        )}

        {size?.kind === "bedrooms" && (
          <Section title="BHK">
            {REQUIREMENT_BEDROOM_OPTIONS.map((n) => (
              <Chip
                key={n}
                label={`${bedroomLabel(n)} BHK`}
                active={Boolean(staged.bedrooms?.includes(n))}
                onPress={() => setStaged((p) => ({ ...p, bedrooms: toggleItem(p.bedrooms, n) }))}
              />
            ))}
          </Section>
        )}

        {size?.kind === "area" && category && SIZE_PRESETS[category] && (
          <Section title={size.label.toUpperCase()}>
            {SIZE_PRESETS[category]!.map((p) => {
              const active = staged.minSqft === p.min && staged.maxSqft === p.max;
              return (
                <Chip
                  key={p.label}
                  label={p.label}
                  active={active}
                  onPress={() =>
                    setStaged((prev) =>
                      active ? { ...prev, minSqft: undefined, maxSqft: undefined } : { ...prev, minSqft: p.min, maxSqft: p.max },
                    )
                  }
                />
              );
            })}
          </Section>
        )}

        {questions.map((q) => (
          <Section key={q.key} title={q.label.toUpperCase()}>
            {q.options.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={Boolean(staged.attributes?.[q.key]?.includes(o.value))}
                onPress={() =>
                  setStaged((prev) => {
                    const nextValues = toggleItem(prev.attributes?.[q.key], o.value);
                    const attributes = { ...prev.attributes, [q.key]: nextValues ?? [] };
                    if (!nextValues) delete attributes[q.key];
                    return { ...prev, attributes: Object.keys(attributes).length ? attributes : undefined };
                  })
                }
              />
            ))}
          </Section>
        ))}

        {amenities.length > 0 && (
          <Section title="YOUR PROPERTY HAS">
            {amenities.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={Boolean(staged.amenities?.includes(o.value))}
                onPress={() => setStaged((p) => ({ ...p, amenities: toggleItem(p.amenities, o.value) }))}
              />
            ))}
          </Section>
        )}

        <Section title="MOVE-IN">
          <Chip label="Any" active={!staged.moveIn} onPress={() => setStaged((p) => ({ ...p, moveIn: undefined }))} />
          {MOVE_IN_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={staged.moveIn === o.value}
              onPress={() => setStaged((p) => ({ ...p, moveIn: p.moveIn === o.value ? undefined : o.value }))}
            />
          ))}
        </Section>

        <Section title="POSTED">
          <Chip label="Any time" active={!staged.postedWithinDays} onPress={() => setStaged((p) => ({ ...p, postedWithinDays: undefined }))} />
          <Chip label="Last 7 days" active={staged.postedWithinDays === 7} onPress={() => setStaged((p) => ({ ...p, postedWithinDays: 7 }))} />
          <Chip label="Last 30 days" active={staged.postedWithinDays === 30} onPress={() => setStaged((p) => ({ ...p, postedWithinDays: 30 }))} />
        </Section>

        <Section title="MORE">
          <Chip
            label="Open to calls"
            active={Boolean(staged.openToCalls)}
            onPress={() => setStaged((p) => ({ ...p, openToCalls: p.openToCalls ? undefined : true }))}
          />
          {hasListings && (
            <Chip
              label="Only ones my listings fit"
              active={Boolean(staged.matchesMyListings)}
              onPress={() => setStaged((p) => ({ ...p, matchesMyListings: p.matchesMyListings ? undefined : true }))}
            />
          )}
        </Section>

        <View style={styles.footerRow}>
          <Pressable onPress={reset} style={[styles.resetButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 14 }}>Reset</Text>
          </Pressable>
          <Pressable onPress={apply} style={[styles.applyButton, { backgroundColor: colors.green }]}>
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Apply</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { fontWeight: "700", fontSize: 19, marginBottom: 16 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: "700", marginBottom: 8, letterSpacing: 0.3 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  resetButton: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  applyButton: { flex: 2, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
});
