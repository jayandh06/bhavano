import type { ListingCategory, TransactionType } from "@bhavano/types";
import type { FieldDef } from "@bhavano/types/categoryFields";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  pruneHiddenAttributes,
} from "@bhavano/types/categoryFields";
import { fieldClass, labelClass } from "@/lib/formStyles";

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

function RequiredLabel({ text }: { text: string }) {
  return (
    <label className={labelClass}>
      {text} <span className="text-[#b3413a]">*</span>
    </label>
  );
}

/** Renders one field's input control — the same switch every category-field form in the app
 * needs (multi-select / select / number / text), factored out so it isn't copy-pasted per
 * consumer of `CATEGORY_FIELD_CONFIG`. */
function CategoryFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  if (field.type === "multi-select") {
    return (
      <select
        multiple
        value={Array.isArray(value) ? value : []}
        onChange={(e) =>
          onChange(Array.from(e.target.selectedOptions, (option) => option.value))
        }
        className={fieldClass}
      >
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        <option value="" disabled>
          Select…
        </option>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      min={field.type === "number" ? (field.min ?? 0) : undefined}
      value={typeof value === "string" ? value : ""}
      onChange={(e) =>
        onChange(
          field.type === "number"
            ? sanitizeNonNegative(e.target.value)
            : e.target.value,
        )
      }
      placeholder={field.placeholder}
      className={fieldClass}
    />
  );
}

/** Groups a category's fields into accordion sections (expanded by default) and hides any
 * field whose Y/N (or other) `dependsOn` condition isn't currently met — e.g. "Brokerage fee"
 * only appears once "Posted by broker" is answered "Yes". Single source of truth for this is
 * `CATEGORY_FIELD_CONFIG` in `@bhavano/types/categoryFields`, shared with the edit-listing form
 * and the listing detail page so all three agree on what's visible. */
export function CategoryFieldsAccordion({
  category,
  transactionType,
  attributes,
  onAttributesChange,
}: {
  category: ListingCategory;
  transactionType: TransactionType;
  attributes: Record<string, string | string[]>;
  onAttributesChange: (
    updater: (
      prev: Record<string, string | string[]>,
    ) => Record<string, string | string[]>,
  ) => void;
}) {
  const visibleFields = CATEGORY_FIELD_CONFIG[category].filter((field) =>
    fieldIsVisible(field, transactionType, attributes),
  );
  const sections = groupFieldsBySection(visibleFields);

  function setFieldValue(field: FieldDef, value: string | string[]) {
    onAttributesChange((prev) =>
      pruneHiddenAttributes(category, transactionType, {
        ...prev,
        [field.key]: value,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map(({ section, label, fields }) => (
        <details
          key={section}
          open
          className="border border-border rounded-[10px] bg-surface"
        >
          <summary className="font-bold text-[13px] text-text cursor-pointer px-4 py-3">
            {label}
          </summary>
          {/* Most fields here are a Yes/No select or a small count — 1-2 words of label, a
              couple of characters of value — so a single-column stack wastes most of the row's
              width. 2 columns on mobile, 3 on desktop; the few fields that genuinely need room
              (free text, multi-select) span the full row instead of getting squeezed. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4 px-4 pb-4">
            {fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.type === "text" || field.type === "multi-select"
                    ? "col-span-full"
                    : undefined
                }
              >
                {field.required ? (
                  <RequiredLabel text={field.label} />
                ) : (
                  <label className={labelClass}>{field.label}</label>
                )}
                <CategoryFieldInput
                  field={field}
                  value={attributes[field.key]}
                  onChange={(value) => setFieldValue(field, value)}
                />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
