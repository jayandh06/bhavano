"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingDetailDto, ListingCategory, TransactionType } from "@bhavano/types";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  pruneHiddenAttributes,
  SECTION_LABELS,
  SECTION_ORDER,
  type FieldDef,
  type FieldOption,
  type FieldSection,
} from "@bhavano/types/categoryFields";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import { TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { clampDigits } from "@bhavano/types/listingLimits";
import { updateListingAction } from "@/app/actions/admin";
import { useClickOutside } from "@/lib/useClickOutside";
import { SelectField } from "./SelectField";

function attributesToStrings(attributes: Record<string, unknown>): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(attributes)) {
    result[key] = Array.isArray(value) ? value.map(String) : value === null || value === undefined ? "" : String(value);
  }
  return result;
}

/** ListingDetailDto.price is display-formatted ("₹15,000" / "Contact for price"), not the raw
 * stored integer the form needs to pre-fill — reversing the format (see
 * ListingsService.toDetailDto) is lossless: strip everything but digits, or 0 when priceOnRequest. */
function parseRawPrice(formattedPrice: string, priceOnRequest: boolean): number {
  if (priceOnRequest) return 0;
  return Number(formattedPrice.replace(/[^\d]/g, ""));
}

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

function sectionOrderIndex(section: FieldSection | "other"): number {
  return section === "other" ? SECTION_ORDER.length : SECTION_ORDER.indexOf(section);
}

/** A `select` field is really a Yes/No question if its only two options are exactly
 * "yes"/"no" — same rule as the web app's CategoryFieldsAccordion, so a field author never has
 * to declare "render me as a toggle" separately from the option list itself. */
function isYesNoField(field: FieldDef): boolean {
  if (field.type !== "select" || field.options?.length !== 2) return false;
  const values = new Set(field.options.map((opt) => opt.value));
  return values.has("yes") && values.has("no");
}

/** Compact pill switch — unset/anything other than "yes" reads as off. */
function YesNoToggle({ checked, onChange }: { checked: boolean; onChange: (value: "yes" | "no") => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(checked ? "no" : "yes")}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        width: 38,
        flexShrink: 0,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: checked ? "var(--green)" : "var(--border)",
        transition: "background-color 120ms",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "inline-block",
          height: 18,
          width: 18,
          borderRadius: "50%",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          transform: `translateX(${checked ? 18 : 2}px)`,
          transition: "transform 120ms",
        }}
      />
    </button>
  );
}

/** Closed-by-default dropdown that opens a checkbox list — same structural pattern as the web
 * app's CheckboxDropdown (toggle button, click-outside-to-close, checkbox rows), restyled with
 * admin's own CSS-variable tokens instead of Tailwind classes. */
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
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={dropdownButtonStyle}>
        <span style={{ color: selected.length === 0 ? "var(--muted)" : "var(--text)" }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 50,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => (
            <label
              key={opt.value}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", fontSize: 13, cursor: "pointer" }}
            >
              <input type="checkbox" checked={selectedSet.has(opt.value)} onChange={() => toggle(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Always-visible ▲/▼ stepper for small counts — same reasoning as the web app's: a native
 * number spinner only shows on hover on desktop and never on mobile, so admins editing on any
 * device need a visible way to change the value besides typing. */
function Stepper({ field, value, onChange }: { field: FieldDef; value: string | undefined; onChange: (value: string) => void }) {
  const maxValue = field.maxDigits !== undefined ? 10 ** field.maxDigits - 1 : undefined;
  const current = Number(value && value !== "" ? value : 0);
  const min = field.min ?? 0;
  const max = maxValue ?? Number.MAX_SAFE_INTEGER;
  const step = (delta: number) => onChange(String(Math.min(max, Math.max(min, current + delta))));

  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden", background: "var(--surface)" }}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={maxValue}
        value={value ?? ""}
        onChange={(e) => onChange(clampDigits(sanitizeNonNegative(e.target.value), field.maxDigits))}
        aria-label={field.label}
        style={{ width: 48, padding: "8px 6px", textAlign: "center", background: "transparent", color: "var(--text)", border: "none", outline: "none" }}
      />
      <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)" }}>
        <button
          type="button"
          aria-label={`Increase ${field.label}`}
          onClick={() => step(1)}
          disabled={current >= max}
          style={stepperButtonStyle}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Decrease ${field.label}`}
          onClick={() => step(-1)}
          disabled={current <= min}
          style={{ ...stepperButtonStyle, borderTop: "1px solid var(--border)" }}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

/** One field's input control — mirrors the web app's CategoryFieldInput switch (toggle /
 * multi-select / select / stepper / text), same field-type behavior, admin-styled controls. */
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
    return <YesNoToggle checked={value === "yes"} onChange={onChange} />;
  }

  if (field.type === "multi-select") {
    return <CheckboxDropdown options={field.options ?? []} selected={Array.isArray(value) ? value : []} onChange={onChange} />;
  }

  if (field.type === "select") {
    return (
      <SelectField value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
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

  if (field.type === "number" && field.stepper) {
    return <Stepper field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />;
  }

  const width = field.type === "number" && field.maxDigits !== undefined && field.maxDigits <= 2 ? 70 : undefined;
  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      min={field.type === "number" ? (field.min ?? 0) : undefined}
      value={typeof value === "string" ? value : ""}
      onChange={(e) =>
        onChange(field.type === "number" ? clampDigits(sanitizeNonNegative(e.target.value), field.maxDigits) : e.target.value)
      }
      placeholder={field.placeholder}
      style={width ? { ...inputStyle, width } : inputStyle}
    />
  );
}

/** One field's label + input. A Yes/No field pairs its label with the toggle inline on the same
 * row (compact enough to share it); every other field keeps the label stacked above the input —
 * same layout rule as the web app's CategoryField. */
function CategoryField({
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-soft)" }}>
          {field.label}
          {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
        </label>
        <CategoryFieldInput field={field} value={value} onChange={onChange} />
      </div>
    );
  }
  return (
    <div>
      <label style={labelStyle}>
        {field.label}
        {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      <CategoryFieldInput field={field} value={value} onChange={onChange} />
    </div>
  );
}

type FieldRun = { fields: FieldDef[] };

/** Keeps a `dependsOn` chain (e.g. "Posted by broker" → "Brokerage fee") adjacent in the layout
 * instead of letting the toggle/other-fields split below scatter its parent and child apart — same
 * grouping the web app's CategoryFieldsAccordion does, copied here since it's plain data logic with
 * no Tailwind/React-DOM dependency.
 *
 * Crucially, every *un*-chained field in a section accumulates into one shared standalone run
 * rather than each getting a run of its own — a first pass at this port dropped that
 * accumulation, so every independent field in "Property details"/"Amenities"/etc. rendered as its
 * own single-item grid, one per row, which read as a flat linear list instead of the packed
 * multi-column layout the web app's post/edit forms use. A chain still gets its own run so its
 * parent and child(ren) stay visually adjacent instead of being folded into the shared batch. */
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
      runs.push({ fields: standaloneRun });
      standaloneRun = [];
    }
    runs.push({ fields: chain });
  }
  if (standaloneRun.length > 0) runs.push({ fields: standaloneRun });
  return runs;
}

/** Renders one run: its Yes/No fields in a compact grid, its other fields in a wider grid,
 * stacked together so a chain (toggle + its follow-up field) always reads as one block. */
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toggleFields.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {toggleFields.map((field) => (
            <CategoryField key={field.key} field={field} value={attributes[field.key]} onChange={(value) => onChange(field, value)} />
          ))}
        </div>
      )}
      {otherFields.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
          {otherFields.map((field) => (
            <div key={field.key} style={field.type === "text" || field.type === "multi-select" ? { gridColumn: "1 / -1" } : undefined}>
              <CategoryField field={field} value={attributes[field.key]} onChange={(value) => onChange(field, value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Admin's own rendering of the same CATEGORY_FIELD_CONFIG the owner's post/edit forms use —
 * same fields, same section grouping, same dependsOn chains/visibility, same toggle/stepper/
 * multi-select control behavior as apps/web's CategoryFieldsAccordion, just laid out with plain
 * inline-styled elements in admin's CSS-variable design system instead of the web app's
 * Tailwind-only component (apps/admin has no Tailwind, and there's no shared component package
 * between the two Next apps — porting the exact widget would mean adding Tailwind to admin just
 * for this one page). */
export function AdminEditListingForm({ listing }: { listing: ListingDetailDto }) {
  const router = useRouter();
  const category = listing.category as ListingCategory;
  const transactionType = listing.transactionType as TransactionType;

  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(parseRawPrice(listing.price, listing.priceOnRequest)));
  const [priceQualifier, setPriceQualifier] = useState(listing.priceQualifier);
  const [description, setDescription] = useState(listing.description ?? "");
  const [specsValue, setSpecsValue] = useState(listing.specs.join(", "));
  const [attributes, setAttributes] = useState<Record<string, string | string[]>>(
    attributesToStrings(listing.attributes),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fieldConfig = CATEGORY_FIELD_CONFIG[category];
  const visibleFields = fieldConfig.filter((field) => fieldIsVisible(field, transactionType, attributes));
  const fieldSections = groupFieldsBySection(visibleFields);
  // Price/Price qualifier aren't category-specific fields, but they belong with the rest of
  // "pricing" all the same — same reasoning as the web app's sectionExtras (CategoryFieldsAccordion),
  // folded into the SAME "Pricing & fees" box as any category-specific pricing fields (maintenance
  // fee, brokerage, etc.) rather than a separate, always-first box of their own. A category with no
  // pricing field of its own (pg/coworking) still needs a "Pricing & fees" box to hold them, so one
  // is added here even when groupFieldsBySection found nothing for that section.
  const sections = fieldSections.some((s) => s.section === "pricing")
    ? fieldSections
    : [{ section: "pricing" as const, label: SECTION_LABELS.pricing, fields: [] as FieldDef[] }, ...fieldSections].sort(
        (a, b) => sectionOrderIndex(a.section) - sectionOrderIndex(b.section),
      );

  const priceOnRequestAllowed = PRICE_ON_REQUEST_CATEGORIES.has(category);
  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  const requiredAttributesFilled = visibleFields.every((field) => {
    if (!field.required) return true;
    const value = attributes[field.key];
    return Array.isArray(value) ? value.length > 0 : (value ?? "").length > 0;
  });
  const valid = (priceValue > 0 || priceOnRequestAllowed) && title.trim().length > 0 && requiredAttributesFilled;

  const priceQualifierOptions = getPriceQualifierOptions(category, transactionType);
  const priceQualifierChoices = priceQualifierOptions.some((opt) => opt.value === priceQualifier)
    ? priceQualifierOptions
    : [
        { value: priceQualifier, label: priceQualifier ? `"${priceQualifier}" (current)` : "(none)" },
        ...priceQualifierOptions,
      ];

  function setFieldValue(field: FieldDef, value: string | string[]) {
    setAttributes((prev) => pruneHiddenAttributes(category, transactionType, { ...prev, [field.key]: value }));
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    const result = await updateListingAction(listing.id, {
      title: title.trim(),
      price: priceValue,
      priceQualifier,
      description: description.trim(),
      specs: specsValue.split(",").map((s) => s.trim()).filter(Boolean),
      attributes,
    });
    setSaving(false);
    if (result.success) {
      setSaved(true);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ maxWidth: 420 }}>
        <label style={labelStyle}>Category / transaction</label>
        <div style={{ ...inputStyle, background: "var(--surface-alt)", color: "var(--text-soft)" }}>
          {listing.category} · {listing.transactionType}
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          Title <span style={{ color: "var(--danger)" }}>*</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 720 }}>
          <input
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
            style={{ ...inputStyle, flex: 1 }}
          />
          <span style={{ fontSize: 11.5, color: title.length >= TITLE_MAX_LENGTH ? "var(--danger)" : "var(--muted)", flexShrink: 0 }}>
            {title.length}/{TITLE_MAX_LENGTH}
          </span>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", maxWidth: 720 }}
        />
      </div>

      {sections.map((section) => (
        <details key={section.section} open style={sectionStyle}>
          <summary style={sectionSummaryStyle}>{section.label}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 16px 16px" }}>
            {section.section === "pricing" && (
              <div style={{ display: "flex", gap: 10 }}>
                <label style={{ ...labelStyle, flex: 1, maxWidth: 200 }}>
                  Price (₹) {!priceOnRequestAllowed && <span style={{ color: "var(--danger)" }}>*</span>}
                  <input
                    type="number"
                    min={priceOnRequestAllowed ? 0 : 1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ ...labelStyle, flex: 1, maxWidth: 220 }}>
                  Price qualifier
                  <SelectField value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)} style={inputStyle}>
                    {priceQualifierChoices.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label || "(none)"}
                      </option>
                    ))}
                  </SelectField>
                </label>
              </div>
            )}
            {groupFieldsByChain(section.fields).map((run) => (
              <FieldRunBlock key={run.fields[0].key} run={run} attributes={attributes} onChange={setFieldValue} />
            ))}
          </div>
        </details>
      ))}

      <label style={{ ...labelStyle, maxWidth: 720 }}>
        Specs (comma-separated)
        <input value={specsValue} onChange={(e) => setSpecsValue(e.target.value)} style={inputStyle} />
      </label>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      {saved && !error && <p style={{ color: "var(--green)", fontSize: 13, margin: 0 }}>Saved.</p>}

      <button onClick={onSave} disabled={saving || !valid} style={primaryButtonStyle}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13.5,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 400,
  width: "100%",
  boxSizing: "border-box",
};

const dropdownButtonStyle: React.CSSProperties = {
  ...inputStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  textAlign: "left",
};

const stepperButtonStyle: React.CSSProperties = {
  width: 28,
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "var(--surface-alt)",
  color: "var(--text-soft)",
  fontSize: 9,
  lineHeight: 1,
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
};

const sectionSummaryStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  padding: "12px 16px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
  alignSelf: "flex-start",
};
