"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingDetailDto, ListingCategory, TransactionType } from "@bhavano/types";
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  pruneHiddenAttributes,
  type FieldDef,
} from "@bhavano/types/categoryFields";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import { TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { updateListingAction } from "@/app/actions/admin";

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

/** One field's input, generic over CATEGORY_FIELD_CONFIG's field types. Deliberately simpler
 * than the web app's CategoryFieldsAccordion (no stepper buttons, no toggle switch, no dropdown
 * checkbox panel) — same fields and validation, styled with admin's own plain inputs rather than
 * porting Tailwind-dependent widgets into an app that doesn't use Tailwind. */
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
    const selected = Array.isArray(value) ? value : [];
    const selectedSet = new Set(selected);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {(field.options ?? []).map((opt) => (
          <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={selectedSet.has(opt.value)}
              onChange={() =>
                onChange(selectedSet.has(opt.value) ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])
              }
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
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
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      style={inputStyle}
    />
  );
}

function CategoryField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
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

/** Admin's own rendering of the same CATEGORY_FIELD_CONFIG the owner's post/edit forms use —
 * same fields, same section grouping, same dependsOn visibility and required-field validation
 * (all shared, framework-agnostic logic from @bhavano/types/categoryFields), just laid out with
 * plain inputs in admin's CSS-variable design system instead of importing the web app's
 * Tailwind-styled CategoryFieldsAccordion (apps/admin has no Tailwind, and there's no shared
 * component package between the two Next apps — porting the exact widget would mean adding
 * Tailwind to admin just for this one page). This is the deliberate middle ground between the
 * old raw-JSON attributes textarea and literally embedding the owner's page. */
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
  const sections = groupFieldsBySection(visibleFields);

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
        <input
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Pricing &amp; fees</div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Price (₹) {!priceOnRequestAllowed && <span style={{ color: "var(--danger)" }}>*</span>}
            <input
              type="number"
              min={priceOnRequestAllowed ? 0 : 1}
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Price qualifier
            <select value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)} style={inputStyle}>
              {priceQualifierChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label || "(none)"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {sections
        .filter((section) => section.fields.length > 0)
        .map((section) => (
          <div key={section.section} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{section.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {section.fields.map((field) => (
                <CategoryField
                  key={field.key}
                  field={field}
                  value={attributes[field.key]}
                  onChange={(value) => setFieldValue(field, value)}
                />
              ))}
            </div>
          </div>
        ))}

      <label style={labelStyle}>
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
