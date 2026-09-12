"use client";

import { useState } from "react";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { updateListingAction } from "@/app/actions/admin";

/** Admin override of a listing's own content — price, title, description, specs, attributes.
 * Separate from ModerationPanel (moderation state / status / delete / thread) since this is a
 * genuinely different kind of action: editing what the listing actually says, not moderating it.
 * Collapsed by default, same "click to expand" pattern ModerationPanel's own Flag/Delete boxes
 * use, so the listing detail page isn't a wall of edit fields by default.
 *
 * Attributes are a raw JSON textarea rather than the full category-specific fields UI
 * (CategoryFieldsAccordion) the web app's own PostAdWizard/EditListingForm use — that component
 * is web-app-only, not in a shared package, and replicating its whole category-field schema here
 * would be a much bigger undertaking than an admin support tool needs on day one. A raw JSON
 * editor is cruder but lets an admin fix any attribute value without per-category UI, which
 * covers the actual "fix a typo/wrong value" use case this exists for. */
export function AdminEditListingPanel({
  listingId,
  category,
  transactionType,
  title,
  price,
  priceQualifier,
  description,
  specs,
  attributes,
}: {
  listingId: string;
  category: ListingCategory;
  transactionType: TransactionType;
  title: string;
  price: number;
  priceQualifier: string;
  description: string | null;
  specs: string[];
  attributes: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [priceValue, setPriceValue] = useState(String(price));
  const [priceQualifierValue, setPriceQualifierValue] = useState(priceQualifier);
  const [descriptionValue, setDescriptionValue] = useState(description ?? "");
  const [specsValue, setSpecsValue] = useState(specs.join(", "));
  const [attributesValue, setAttributesValue] = useState(JSON.stringify(attributes, null, 2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const priceQualifierOptions = getPriceQualifierOptions(category, transactionType);

  async function onSave() {
    setError(null);
    setSaved(false);

    const parsedPrice = Number(priceValue);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a whole number, 0 or more.");
      return;
    }

    let parsedAttributes: Record<string, unknown>;
    try {
      parsedAttributes = JSON.parse(attributesValue);
    } catch {
      setError("Attributes isn't valid JSON — fix the syntax before saving.");
      return;
    }

    setPending(true);
    const result = await updateListingAction(listingId, {
      title: titleValue.trim(),
      price: parsedPrice,
      priceQualifier: priceQualifierValue,
      description: descriptionValue.trim(),
      specs: specsValue.split(",").map((s) => s.trim()).filter(Boolean),
      attributes: parsedAttributes,
    });
    setPending(false);
    if (result.success) setSaved(true);
    else setError(result.error);
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={outlineButtonStyle}>
        Edit listing details
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Edit listing details (admin override)</div>
        <button onClick={() => setExpanded(false)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>
          Collapse
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={labelStyle}>
          Title
          <input value={titleValue} onChange={(e) => setTitleValue(e.target.value)} style={inputStyle} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Price (₹)
            <input
              type="number"
              min={0}
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Price qualifier
            <select value={priceQualifierValue} onChange={(e) => setPriceQualifierValue(e.target.value)} style={inputStyle}>
              {priceQualifierOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label || "(none)"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={labelStyle}>
          Description
          <textarea
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </label>

        <label style={labelStyle}>
          Specs (comma-separated)
          <input value={specsValue} onChange={(e) => setSpecsValue(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Attributes (raw JSON — edit carefully, this isn't validated field-by-field like the
          post form is)
          <textarea
            value={attributesValue}
            onChange={(e) => setAttributesValue(e.target.value)}
            rows={6}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12.5 }}
          />
        </label>

        {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
        {saved && !error && <p style={{ color: "var(--green)", fontSize: 13, margin: 0 }}>Saved.</p>}

        <button onClick={onSave} disabled={pending} style={primaryButtonStyle}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
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

const outlineButtonStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--text)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};
