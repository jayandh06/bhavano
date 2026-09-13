import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible, groupFieldsBySection } from "@bhavano/types/categoryFields";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon, isIconName } from "../Icon";

function websiteHref(value: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

function formatAttributeValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return String(value);
}

/**
 * Mirrors the website's grouped attribute cards on `ListingDetailView.tsx` — same visibility rule
 * (`fieldIsVisible`, amenities dropped unless "yes") and the same shared `groupFieldsBySection`
 * grouping, so this and the website can never disagree on what a listing's detail page shows.
 * Amenities render as a flat badge list (icon + name only, no value — presence already means
 * "yes"); everything else as a wrapped label/value list, since RN has no CSS grid to lean on.
 */
export function ListingAttributeSections({
  category,
  transactionType,
  attributes,
}: {
  category: ListingCategory;
  transactionType: TransactionType;
  attributes: Record<string, unknown>;
}) {
  const { colors } = useAppTheme();
  const attrs = attributes as Record<string, string | string[]>;
  const visibleFields = CATEGORY_FIELD_CONFIG[category].filter((field) => {
    if (!(field.key in attrs)) return false;
    if (!fieldIsVisible(field, transactionType, attrs)) return false;
    if (field.section === "amenities" && attrs[field.key] !== "yes") return false;
    return true;
  });
  if (visibleFields.length === 0) return null;
  const sections = groupFieldsBySection(visibleFields);

  return (
    <View style={{ gap: 12 }}>
      {sections.map(({ section, label, fields }) => (
        <View key={section} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: colors.text, marginBottom: 10 }}>{label}</Text>
          {section === "amenities" ? (
            <View style={styles.badgeRow}>
              {fields.map((field) => (
                <View key={field.key} style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                  {isIconName(field.iconName) && <Icon name={field.iconName} size={13} color={colors.muted} />}
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.textSoft }}>{field.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {fields.map((field) => (
                <View key={field.key} style={styles.gridCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    {isIconName(field.iconName) && <Icon name={field.iconName} size={13} color={colors.muted} />}
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.text }}>{field.label}</Text>
                  </View>
                  {field.key === "website" && attrs[field.key] ? (
                    <Pressable onPress={() => Linking.openURL(websiteHref(String(attrs[field.key])))}>
                      <Text style={{ fontSize: 13, color: colors.green, fontWeight: "600" }}>{String(attrs[field.key])}</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ fontSize: 13, color: colors.textSoft }}>{formatAttributeValue(attrs[field.key])}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCell: { minWidth: "42%", gap: 2 },
});
