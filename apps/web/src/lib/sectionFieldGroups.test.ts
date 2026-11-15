import { describe, expect, it } from "vitest";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  groupSectionFields,
  SECTION_FIELD_GROUPS,
  type FieldDef,
} from "@bhavano/types/categoryFields";

const TRANSACTIONS: TransactionType[] = ["sell", "rent", "lease"];
const CATEGORIES = Object.keys(CATEGORY_FIELD_CONFIG) as ListingCategory[];

/** Every field of a category shown, as if every Yes/No gate were answered so that it opens its follow-ups. */
function allOpen(category: ListingCategory, transactionType: TransactionType): FieldDef[] {
  const attrs: Record<string, string | string[]> = {};
  for (const field of CATEGORY_FIELD_CONFIG[category]) {
    if (field.dependsOn) attrs[field.dependsOn.key] = field.dependsOn.value;
    if (field.alsoDependsOn) attrs[field.alsoDependsOn.key] = field.alsoDependsOn.value;
  }
  for (const field of CATEGORY_FIELD_CONFIG[category]) {
    const gate = CATEGORY_FIELD_CONFIG[category].find((f) => f.key === field.dependsOn?.key);
    if (gate?.type === "multi-select" && field.dependsOn) attrs[gate.key] = [...((attrs[gate.key] as string[] | undefined) ?? []), field.dependsOn.value].filter(
      (v, i, a) => typeof v === "string" && a.indexOf(v) === i,
    );
  }
  return CATEGORY_FIELD_CONFIG[category].filter((field) => fieldIsVisible(field, transactionType, attrs));
}

describe("groupSectionFields", () => {
  it("keeps every field, exactly once, for every category and transaction type", () => {
    for (const category of CATEGORIES) {
      for (const transactionType of TRANSACTIONS) {
        for (const { section, fields } of groupFieldsBySection(allOpen(category, transactionType))) {
          const grouped = groupSectionFields(section, fields).flatMap((g) => g.fields.map((f) => f.key));
          expect(grouped.sort(), `${category} ${transactionType} ${section}`).toEqual(fields.map((f) => f.key).sort());
        }
      }
    }
  });

  it("never separates a follow-up field from the question that opens it, and puts the question first", () => {
    for (const category of CATEGORIES) {
      for (const transactionType of TRANSACTIONS) {
        for (const { section, fields } of groupFieldsBySection(allOpen(category, transactionType))) {
          for (const group of groupSectionFields(section, fields)) {
            const keys = group.fields.map((f) => f.key);
            for (const field of group.fields) {
              const parent = field.dependsOn?.key;
              if (!parent || !fields.some((f) => f.key === parent)) continue;
              expect(keys, `${category} ${transactionType}: ${field.key} must sit with ${parent}`).toContain(parent);
              expect(keys.indexOf(parent), `${category} ${transactionType}: ${parent} before ${field.key}`).toBeLessThan(keys.indexOf(field.key));
            }
          }
        }
      }
    }
  });

  it("leaves nothing in the 'More details' catch-all for any postable category today", () => {
    for (const category of CATEGORIES) {
      for (const transactionType of TRANSACTIONS) {
        for (const { section, fields } of groupFieldsBySection(allOpen(category, transactionType))) {
          const more = groupSectionFields(section, fields).find((g) => g.id === "more-details");
          expect(more?.fields.map((f) => f.key) ?? [], `${category} ${transactionType} ${section}`).toEqual([]);
        }
      }
    }
  });

  it("puts a field the group list doesn't name into a trailing 'More details' group", () => {
    const groups = groupSectionFields("basics", [
      { key: "bedrooms" },
      { key: "somethingNew" },
      { key: "carpetAreaSqft" },
    ]);
    expect(groups.map((g) => [g.label, g.fields.map((f) => f.key)])).toEqual([
      ["Rooms", ["bedrooms"]],
      ["Size & floor", ["carpetAreaSqft"]],
      ["More details", ["somethingNew"]],
    ]);
  });

  it("orders fields by the group's own list and drops the heading when only one group is left", () => {
    expect(groupSectionFields("basics", [{ key: "floor" }, { key: "carpetAreaSqft" }])).toEqual([
      { id: "size", label: null, fields: [{ key: "carpetAreaSqft" }, { key: "floor" }] },
    ]);
  });

  it("returns a section without a group list as one unlabelled group", () => {
    expect(SECTION_FIELD_GROUPS.amenities).toBeUndefined();
    expect(groupSectionFields("amenities", [{ key: "lift" }, { key: "gym" }])).toEqual([
      { id: "all", label: null, fields: [{ key: "lift" }, { key: "gym" }] },
    ]);
    expect(groupSectionFields("amenities", [])).toEqual([]);
  });

  it("splits an apartment's Property details into the named groups", () => {
    const fields = allOpen("apartment", "sell").filter((f) => f.section === "basics");
    expect(groupSectionFields("basics", fields).map((g) => g.label)).toEqual([
      "Rooms",
      "Size & floor",
      "Parking",
      "Furnishing & utilities",
      "Society & outdoor space",
      "Availability",
      "Ownership & legal",
    ]);
  });
});
