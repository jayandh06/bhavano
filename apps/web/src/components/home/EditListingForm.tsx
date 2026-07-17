"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
import { updateListingAction } from "@/app/actions/listings";

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

function attributesToStrings(attributes: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    result[key] = value === null || value === undefined ? "" : String(value);
  }
  return result;
}

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: "active", label: "Active — visible to buyers/renters" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "deactivated", label: "Deactivated — hidden from search" },
];

export function EditListingForm({ listing }: { listing: ListingDetailDto }) {
  const router = useRouter();
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(listing.price).replace(/[^0-9]/g, ""));
  const [priceQualifier, setPriceQualifier] = useState(listing.priceQualifier);
  const [specs, setSpecs] = useState(listing.specs.join(", "));
  const [attributes, setAttributes] = useState<Record<string, string>>(attributesToStrings(listing.attributes));
  const [status, setStatus] = useState<ListingStatus>(listing.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fieldConfig = CATEGORY_FIELD_CONFIG[listing.category];
  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  const valid = priceValue > 0 && title.trim().length > 0;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateListingAction(listing.id, {
      title: title.trim(),
      price: priceValue,
      priceQualifier: priceQualifier || undefined,
      specs: specs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      attributes,
      status,
    });
    setSaving(false);
    if (result.success) {
      setMessage({ type: "success", text: "Listing updated." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label style={labelStyle}>Category / transaction</label>
        <div style={readOnlyStyle}>
          {listing.category} · {listing.transactionType}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Price (₹) *</label>
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(sanitizeNonNegative(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Price qualifier</label>
          <input value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Specs (comma-separated)</label>
        <input value={specs} onChange={(e) => setSpecs(e.target.value)} style={inputStyle} />
      </div>

      {fieldConfig.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {fieldConfig.map((field) => (
            <div key={field.key}>
              <label style={labelStyle}>{field.label}</label>
              {field.type === "select" ? (
                <select
                  value={attributes[field.key] ?? ""}
                  onChange={(e) => setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  style={inputStyle}
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
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  min={field.type === "number" ? 0 : undefined}
                  value={attributes[field.key] ?? ""}
                  onChange={(e) =>
                    setAttributes((prev) => ({
                      ...prev,
                      [field.key]: field.type === "number" ? sanitizeNonNegative(e.target.value) : e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <label style={labelStyle}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)} style={inputStyle}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "#b3413a", margin: 0 }}>
          {message.text}
        </p>
      )}

      <button onClick={onSave} disabled={saving || !valid} style={{ ...saveButtonStyle, opacity: saving || !valid ? 0.6 : 1 }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
};

const readOnlyStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontSize: 14,
  background: "var(--surface-alt)",
  color: "var(--text-soft)",
};

const saveButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: 13,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
