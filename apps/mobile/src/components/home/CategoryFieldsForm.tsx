import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible, groupFieldsBySection } from "@bhavano/types/categoryFields";
import { areaUnitShortLabel, type AreaUnit } from "@bhavano/types/areaUnit";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

type FieldConfig = (typeof CATEGORY_FIELD_CONFIG)[ListingCategory][number];
type Attributes = Record<string, string | string[]>;

/** Same three predicates PostAdWizard.tsx keeps for its own copy of this field grid — not shared
 * across the two (see this file's own top-of-module comment) so each stays free to diverge if a
 * step ever needs to, same as web's CategoryFieldsAccordion staying independent of PostAdWizard's
 * inline rendering before that got extracted there too. */
function isSegmented(field: FieldConfig): boolean {
  return (
    field.type === "select" &&
    !!field.options &&
    field.options.length <= 3 &&
    field.options.every((o) => o.label.length <= 12)
  );
}

function isCounter(field: FieldConfig): boolean {
  return field.type === "number" && (field.stepper === true || field.key.endsWith("Count"));
}

function maxCountFor(field: FieldConfig): number {
  return 10 ** (field.maxDigits ?? 2) - 1;
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Unlike every other numeric field here (counts, prices — always whole numbers), an area value
 * is routinely a decimal ("2.5 acres") — this keeps digits and at most one decimal point instead
 * of `digitsOnly`'s all-digits rule. */
function sanitizeAreaInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

function clampDigits(value: string, maxDigits: number | undefined): string {
  return maxDigits === undefined ? value : value.slice(0, maxDigits);
}

/** The category-specific attribute grid — grouped-by-section counters/segmented controls/select
 * sheets/text inputs — shared by PostAdWizard's "details" step and the edit screen
 * (app/my-listings/[id]/edit.tsx). Pulled out on the edit screen's account rather than duplicated
 * a second time inline, mirroring how apps/web factors the identical UI into
 * CategoryFieldsAccordion for its own PostAdWizard/EditListingForm split. Renders just the field
 * grid + its own option-picker sheet — no heading, no Price/Price qualifier (the caller's own
 * concern, same division web's `sectionExtras` prop draws). */
export function CategoryFieldsForm({
  category,
  transactionType,
  attributes,
  onAttributesChange,
}: {
  category: ListingCategory;
  transactionType: TransactionType;
  attributes: Attributes;
  onAttributesChange: (updater: (prev: Attributes) => Attributes) => void;
}) {
  const { colors } = useAppTheme();
  const optionSheetRef = useRef<BottomSheetModal>(null);
  const [openField, setOpenField] = useState<FieldConfig | null>(null);

  const visibleFields = CATEGORY_FIELD_CONFIG[category].filter((field) =>
    fieldIsVisible(field, transactionType, attributes),
  );

  function countOf(key: string): number {
    const raw = attributes[key];
    return typeof raw === "string" ? Number(raw) || 0 : 0;
  }

  function bumpCount(field: FieldConfig, delta: number) {
    onAttributesChange((prev) => {
      const current = typeof prev[field.key] === "string" ? Number(prev[field.key]) || 0 : 0;
      const next = Math.min(maxCountFor(field), Math.max(0, current + delta));
      return { ...prev, [field.key]: String(next) };
    });
  }

  function toggleMulti(key: string, value: string) {
    onAttributesChange((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  return (
    <>
      {groupFieldsBySection(visibleFields).map((group) => (
        <View key={group.section}>
          <Text
            style={[
              styles.sectionHeading,
              { color: colors.green, backgroundColor: colors.surfaceAlt, borderLeftColor: colors.green },
            ]}
          >
            {group.label}
          </Text>
          <View style={styles.attrGrid}>
            {group.fields.map((field) => {
              const segmented = isSegmented(field);
              const counter = isCounter(field);
              const selectedOption = field.options?.find((o) => o.value === attributes[field.key]);
              const chosen = Array.isArray(attributes[field.key]) ? (attributes[field.key] as string[]) : [];
              const summaryLabel =
                field.type === "multi-select"
                  ? field.options
                      ?.filter((o) => chosen.includes(o.value))
                      .map((o) => o.label)
                      .join(", ") || null
                  : (selectedOption?.label ?? null);

              return (
                <View key={field.key} style={styles.attrCell}>
                  <Text style={[styles.label, { color: colors.textSoft }]} numberOfLines={2}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Text>
                  {field.type === "area" ? (
                    <View style={{ gap: 8 }}>
                      <TextInput
                        value={typeof attributes[field.key] === "string" ? (attributes[field.key] as string) : ""}
                        onChangeText={(v) => onAttributesChange((prev) => ({ ...prev, [field.key]: sanitizeAreaInput(v) }))}
                        keyboardType="decimal-pad"
                        placeholder={field.placeholder}
                        placeholderTextColor={colors.muted}
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                      />
                      {/* Only Plot/Commercial ever have more than one unit — every other area
                        * field renders as a plain number input, same as before this field type
                        * existed. */}
                      {(field.units ?? ["sqft"]).length > 1 && (
                        <View style={[styles.segmented, { borderColor: colors.border, flexWrap: "wrap" }]}>
                          {(field.units ?? ["sqft"]).map((unit, i) => {
                            const current = (attributes[`${field.key}Unit`] as AreaUnit | undefined) ?? "sqft";
                            const selected = current === unit;
                            return (
                              <Pressable
                                key={unit}
                                onPress={() => onAttributesChange((prev) => ({ ...prev, [`${field.key}Unit`]: unit }))}
                                style={[
                                  styles.segment,
                                  i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                                  selected && { backgroundColor: colors.green },
                                ]}
                              >
                                <Text
                                  style={{ color: selected ? colors.onGreen : colors.text, fontSize: 12, fontWeight: "700" }}
                                  numberOfLines={1}
                                >
                                  {/* value=2 forces the pluralized short form ("acres", not "acre") for a picker chip. */}
                                  {areaUnitShortLabel(unit, 2)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ) : counter ? (
                    <View style={[styles.counter, { borderColor: colors.border }]}>
                      <Pressable
                        onPress={() => bumpCount(field, -1)}
                        hitSlop={8}
                        style={[styles.counterButton, { borderRightWidth: 1, borderRightColor: colors.border }]}
                      >
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>−</Text>
                      </Pressable>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" }}>
                        {countOf(field.key)}
                      </Text>
                      <Pressable
                        onPress={() => bumpCount(field, 1)}
                        hitSlop={8}
                        style={[styles.counterButton, { borderLeftWidth: 1, borderLeftColor: colors.border }]}
                      >
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>+</Text>
                      </Pressable>
                    </View>
                  ) : segmented ? (
                    <View style={[styles.segmented, { borderColor: colors.border }]}>
                      {field.options?.map((opt, i) => {
                        const selected = attributes[field.key] === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            onPress={() => onAttributesChange((prev) => ({ ...prev, [field.key]: opt.value }))}
                            style={[
                              styles.segment,
                              i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                              selected && { backgroundColor: colors.green },
                            ]}
                          >
                            <Text
                              style={{ color: selected ? colors.onGreen : colors.text, fontSize: 12.5, fontWeight: "700" }}
                              numberOfLines={1}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : field.type === "multi-select" || field.type === "select" ? (
                    <Pressable
                      onPress={() => {
                        setOpenField(field);
                        optionSheetRef.current?.present();
                      }}
                      style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    >
                      <Text
                        style={{ color: summaryLabel ? colors.text : colors.muted, fontSize: 13.5, flex: 1 }}
                        numberOfLines={1}
                      >
                        {summaryLabel ?? "Select…"}
                      </Text>
                      <Icon name="chevronDown" size={13} color={colors.muted} />
                    </Pressable>
                  ) : (
                    <TextInput
                      value={typeof attributes[field.key] === "string" ? (attributes[field.key] as string) : ""}
                      onChangeText={(v) =>
                        onAttributesChange((prev) => ({ ...prev, [field.key]: sanitizeFieldInput(field, v) }))
                      }
                      keyboardType={field.type === "number" ? "number-pad" : "default"}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.muted}
                      style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <BottomSheetModal
        ref={optionSheetRef}
        snapPoints={["50%"]}
        backgroundStyle={{ backgroundColor: colors.surface }}
        onDismiss={() => setOpenField(null)}
      >
        <BottomSheetView style={styles.optionSheet}>
          <Text style={[styles.optionSheetTitle, { color: colors.text }]}>{openField?.label}</Text>
          {openField?.options?.map((opt) => {
            const multi = openField.type === "multi-select";
            const current = attributes[openField.key];
            const selected = multi
              ? Array.isArray(current) && current.includes(opt.value)
              : current === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  if (multi) {
                    toggleMulti(openField.key, opt.value);
                  } else {
                    onAttributesChange((prev) => ({ ...prev, [openField.key]: opt.value }));
                    optionSheetRef.current?.dismiss();
                  }
                }}
                style={styles.optionRow}
              >
                <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{opt.label}</Text>
                {selected && <Icon name="check" size={15} color={colors.green} />}
              </Pressable>
            );
          })}
          {openField?.type === "multi-select" && (
            <Pressable
              onPress={() => optionSheetRef.current?.dismiss()}
              style={[styles.doneButton, { backgroundColor: colors.green }]}
            >
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Done</Text>
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

/** Exported for the edit screen's plain (non-counter, non-select) text fields, which need the
 * same digit-clamping PostAdWizard applies — kept here rather than a third copy. */
export function sanitizeFieldInput(field: FieldConfig, value: string): string {
  return field.type === "number" ? clampDigits(digitsOnly(value), field.maxDigits) : value;
}

const styles = StyleSheet.create({
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 22,
    marginBottom: 10,
    overflow: "hidden",
  },
  attrGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12 },
  attrCell: { width: "47%", flexGrow: 1 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  counter: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  counterButton: { paddingVertical: 9, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  readOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, minHeight: 44 },
  optionSheet: { paddingHorizontal: 20, paddingBottom: 24 },
  optionSheetTitle: { fontWeight: "700", fontSize: 17, marginBottom: 12 },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  doneButton: { borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 12 },
});
