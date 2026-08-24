import { useRef, useState } from "react";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import type { FieldDef, FieldOption } from "@bhavano/types/categoryFields";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  pruneHiddenAttributes,
} from "@bhavano/types/categoryFields";
import { fieldClass, labelClass } from "@/lib/formStyles";
import { useClickOutside } from "@/lib/useClickOutside";

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

/** Truncates to at most `maxDigits` characters — HTML's `maxlength` doesn't apply to
 * `type="number"` inputs, so this is the only thing that actually stops someone typing a 3rd
 * digit into a count field that should never need one. */
function clampDigits(value: string, maxDigits: number | undefined): string {
  return maxDigits === undefined ? value : value.slice(0, maxDigits);
}

/** Multi-select as a closed dropdown button that opens a checkbox list — same structural
 * pattern as `AreaFilter`/`BhkFilter` (toggle button, click-outside-to-close panel, checkbox
 * rows), just generic over any option list instead of URL-derived filter state. A native
 * `<select multiple>` needs a modifier key to pick more than one option and shows every option
 * at once regardless of how many are picked, which is why this replaces it here. */
function CheckboxDropdown({
  options,
  selected,
  onChange,
}: {
  options: FieldOption[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const selectedSet = new Set(selected);
  const label =
    selected.length === 0
      ? "Select…"
      : selected.length === 1
        ? (options.find((opt) => opt.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  function toggle(value: string) {
    onChange(
      selectedSet.has(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${fieldClass} flex items-center justify-between text-left cursor-pointer`}
      >
        <span className={selected.length === 0 ? "text-muted" : undefined}>
          {label}
        </span>
        <span className="text-[10px] text-muted ml-2">▾</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-surface border border-border rounded-[10px] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 max-h-[220px] overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-1 py-[7px] text-[13px] text-text cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** A `select` field is really a Yes/No question if its only two options are exactly
 * "yes"/"no" — those render as a toggle switch instead of a dropdown. */
function isYesNoField(field: FieldDef): boolean {
  if (field.type !== "select" || field.options?.length !== 2) return false;
  const values = new Set(field.options.map((opt: FieldOption) => opt.value));
  return values.has("yes") && values.has("no");
}

/** Compact iOS-style switch — unset/anything other than "yes" reads as off, so a Yes/No field
 * defaults to "No" without needing to pre-fill `attributes` before the user touches it. */
function YesNoToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: "yes" | "no") => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(checked ? "no" : "yes")}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border-0 cursor-pointer transition-colors ${
        checked ? "bg-green" : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-surface shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

/** Renders one field's input control — the same switch every category-field form in the app
 * needs (toggle / multi-select / select / number / text), factored out so it isn't copy-pasted
 * per consumer of `CATEGORY_FIELD_CONFIG`. */
function CategoryFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  if (isYesNoField(field)) {
    return (
      <YesNoToggle checked={value === "yes"} onChange={onChange} />
    );
  }

  if (field.type === "multi-select") {
    return (
      <CheckboxDropdown
        options={field.options ?? []}
        selected={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
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

  const maxValue =
    field.type === "number" && field.maxDigits !== undefined
      ? 10 ** field.maxDigits - 1
      : undefined;
  // A 2-digit count doesn't need a full-width box to type into — stretching it the same as a
  // 6-digit price/area field just leaves a wide empty input with a couple of characters in it.
  const className =
    field.type === "number" && field.maxDigits !== undefined
      ? fieldClass.replace("w-full", "w-20")
      : fieldClass;

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      min={field.type === "number" ? (field.min ?? 0) : undefined}
      max={maxValue}
      value={typeof value === "string" ? value : ""}
      onChange={(e) =>
        onChange(
          field.type === "number"
            ? clampDigits(sanitizeNonNegative(e.target.value), field.maxDigits)
            : e.target.value,
        )
      }
      placeholder={field.placeholder}
      className={className}
    />
  );
}

/** One field's label + input. A Yes/No field pairs its label with the toggle inline on the same
 * row (the toggle is compact enough to share the row); every other field keeps the label
 * stacked above the input. Labels always truncate to one line rather than wrapping — `title`
 * carries the full text for anything long enough to actually get clipped. */
function CategoryField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const labelText = field.required ? (
    <>
      {field.label} <span className="text-[#b3413a]">*</span>
    </>
  ) : (
    field.label
  );

  if (isYesNoField(field)) {
    return (
      <div className="flex items-center justify-between gap-2">
        <label
          className="text-[13px] font-bold text-text-soft truncate"
          title={field.label}
        >
          {labelText}
        </label>
        <CategoryFieldInput field={field} value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div>
      <label className={`${labelClass} truncate`} title={field.label}>
        {labelText}
      </label>
      <CategoryFieldInput field={field} value={value} onChange={onChange} />
    </div>
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
          {(() => {
            // Toggle fields pair a label with a switch on the same row, so they need more
            // width per item than a stacked label-above-input field does — they get their own,
            // wider grid (1 column on mobile, 2 on desktop) rather than sharing the tighter
            // count/select grid below, where their labels would truncate.
            const toggleFields = fields.filter(isYesNoField);
            const otherFields = fields.filter((field) => !isYesNoField(field));
            return (
              <div className="flex flex-col gap-4 px-4 pb-4">
                {toggleFields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    {toggleFields.map((field) => (
                      <CategoryField
                        key={field.key}
                        field={field}
                        value={attributes[field.key]}
                        onChange={(value) => setFieldValue(field, value)}
                      />
                    ))}
                  </div>
                )}
                {otherFields.length > 0 && (
                  // Most of these are a small count or short pick from a handful of options, so
                  // a single-column stack wastes most of the row's width. The few fields that
                  // genuinely need room (free text, multi-select) span the full row instead of
                  // getting squeezed.
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4">
                    {otherFields.map((field) => (
                      <div
                        key={field.key}
                        className={
                          field.type === "text" || field.type === "multi-select"
                            ? "col-span-full"
                            : undefined
                        }
                      >
                        <CategoryField
                          field={field}
                          value={attributes[field.key]}
                          onChange={(value) => setFieldValue(field, value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </details>
      ))}
    </div>
  );
}
