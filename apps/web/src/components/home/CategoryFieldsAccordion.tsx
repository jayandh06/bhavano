import { useRef, useState, type ReactNode } from "react";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import type { FieldDef, FieldOption, FieldSection } from "@bhavano/types/categoryFields";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  pruneHiddenAttributes,
} from "@bhavano/types/categoryFields";
import { clampDigits } from "@bhavano/types/listingLimits";
import { fieldClass, labelClass } from "@/lib/formStyles";
import { SelectField } from "./SelectField";
import { useClickOutside } from "@/lib/useClickOutside";

/** Half of the stacked arrow column beside a counter's value — no border or radius of its own,
 * since the wrapper supplies the frame. */
const stepperButtonClass =
  "w-8 flex-1 flex items-center justify-center border-0 bg-surface-alt text-text-soft text-[9px] leading-none cursor-pointer hover:text-green disabled:opacity-35 disabled:cursor-default disabled:hover:text-text-soft";

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

/** Truncates to at most `maxDigits` characters — HTML's `maxlength` doesn't apply to
 * `type="number"` inputs, so this is the only thing that actually stops someone typing a 3rd
 * digit into a count field that should never need one. */

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
      <SelectField value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Select…
        </option>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </SelectField>
    );
  }

  const maxValue =
    field.type === "number" && field.maxDigits !== undefined
      ? 10 ** field.maxDigits - 1
      : undefined;

  // Always-visible −/+ buttons for small counts. `<input type="number">` spinners are not a
  // substitute: desktop browsers only reveal them on hover, and phones never show them at all,
  // so on the devices most posters use there was no visible way to change the number except the
  // keyboard.
  if (field.type === "number" && field.stepper) {
    const current = Number(typeof value === "string" && value !== "" ? value : 0);
    const min = field.min ?? 0;
    const max = maxValue ?? Number.MAX_SAFE_INTEGER;
    const step = (delta: number) => onChange(String(Math.min(max, Math.max(min, current + delta))));
    // One bordered control rather than three loose ones: the value and its arrows share a
    // frame, so a row of counters reads as a column of fields instead of a scatter of buttons.
    // Stacked up/down rather than −/+ on either side — the same shape as the spinner a browser
    // would draw, but visible on every device and in the app's own colours.
    return (
      <div className="inline-flex items-stretch border border-border rounded-[9px] bg-surface overflow-hidden">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={maxValue}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(clampDigits(sanitizeNonNegative(e.target.value), field.maxDigits))}
          aria-label={field.label}
          className="w-14 px-2 py-3 text-base sm:text-sm text-center bg-transparent text-text outline-none border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className="flex flex-col border-l border-border">
          <button
            type="button"
            aria-label={`Increase ${field.label}`}
            onClick={() => step(1)}
            disabled={current >= max}
            className={stepperButtonClass}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`Decrease ${field.label}`}
            onClick={() => step(-1)}
            disabled={current <= min}
            className={`${stepperButtonClass} border-t border-border`}
          >
            ▼
          </button>
        </div>
      </div>
    );
  }

  // A 2-digit count doesn't need a full-width box to type into — stretching it the same as a
  // 6-digit price/area field just leaves a wide empty input with a couple of characters in it.
  // Keyed on <= 2 rather than "has a limit at all", so capping carpet area or a fee at 5 digits
  // does not also shrink its box to a width those digits cannot fit.
  const className =
    field.type === "number" && field.maxDigits !== undefined && field.maxDigits <= 2
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

type FieldRun =
  | { kind: "standalone"; fields: FieldDef[] }
  | { kind: "chain"; fields: FieldDef[] };

/** Splits a section's fields into runs, keeping a `dependsOn` chain (e.g. "Posted by broker" →
 * "Has brokerage fee" → "Brokerage fee") together as one block instead of scattering the toggle
 * into a shared toggle grid and the amount field into a shared number grid elsewhere in the
 * section — a chain is one decision with a follow-up, so it should read as one, not get split
 * apart by field type. Fields with no chain partner in this section stay batched together for
 * grid density, same as before. */
function groupFieldsByChain(fields: FieldDef[]): FieldRun[] {
  const keysInSection = new Set(fields.map((field) => field.key));
  const childrenOf = new Map<string, FieldDef[]>();
  const roots: FieldDef[] = [];
  for (const field of fields) {
    const parentKey = field.dependsOn?.key;
    if (parentKey && keysInSection.has(parentKey)) {
      const siblings = childrenOf.get(parentKey);
      if (siblings) siblings.push(field);
      else childrenOf.set(parentKey, [field]);
    } else {
      roots.push(field);
    }
  }
  function collectChain(field: FieldDef): FieldDef[] {
    const children = childrenOf.get(field.key) ?? [];
    return [field, ...children.flatMap(collectChain)];
  }

  const runs: FieldRun[] = [];
  let standaloneRun: FieldDef[] = [];
  for (const root of roots) {
    const chain = collectChain(root);
    if (chain.length === 1) {
      standaloneRun.push(root);
      continue;
    }
    if (standaloneRun.length > 0) {
      runs.push({ kind: "standalone", fields: standaloneRun });
      standaloneRun = [];
    }
    runs.push({ kind: "chain", fields: chain });
  }
  if (standaloneRun.length > 0) runs.push({ kind: "standalone", fields: standaloneRun });
  return runs;
}

/** Renders one run from `groupFieldsByChain` — same toggle-grid / other-grid split as before,
 * just scoped to the run's own fields instead of the whole section, so a chain's toggle(s) and
 * trailing amount field stay adjacent while still getting the same compact grid treatment. */
function FieldRunBlock({
  run,
  attributes,
  onChange,
}: {
  run: FieldRun;
  attributes: Record<string, string | string[]>;
  onChange: (field: FieldDef, value: string | string[]) => void;
}) {
  const toggleFields = run.fields.filter(isYesNoField);
  const otherFields = run.fields.filter((field) => !isYesNoField(field));
  return (
    <div className="flex flex-col gap-3">
      {toggleFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          {toggleFields.map((field) => (
            <CategoryField
              key={field.key}
              field={field}
              value={attributes[field.key]}
              onChange={(value) => onChange(field, value)}
            />
          ))}
        </div>
      )}
      {otherFields.length > 0 && (
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
                onChange={(value) => onChange(field, value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
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
  const labelText = (
    <>
      {field.icon && <span className="mr-1">{field.icon}</span>}
      {field.label}
      {field.required && <span className="text-[#b3413a]"> *</span>}
    </>
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
  sectionExtras,
}: {
  category: ListingCategory;
  transactionType: TransactionType;
  attributes: Record<string, string | string[]>;
  onAttributesChange: (
    updater: (
      prev: Record<string, string | string[]>,
    ) => Record<string, string | string[]>,
  ) => void;
  /** Extra content rendered at the top of a given section's box, above its dynamic fields —
   * e.g. the wizard folds its (non-category-specific) Price/Price Qualifier inputs into the
   * top of "pricing" this way rather than duplicating the section-box chrome for them. */
  sectionExtras?: Partial<Record<FieldSection, ReactNode>>;
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
            const extra = section !== "other" ? sectionExtras?.[section] : undefined;
            const runs = groupFieldsByChain(fields);
            return (
              <div className="flex flex-col gap-4 px-4 pb-4">
                {extra}
                {runs.map((run) => (
                  <FieldRunBlock
                    key={run.fields[0].key}
                    run={run}
                    attributes={attributes}
                    onChange={setFieldValue}
                  />
                ))}
              </div>
            );
          })()}
        </details>
      ))}
    </div>
  );
}
