"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import {
  CATEGORY_FIELD_CONFIG,
  SECTION_LABELS,
  fieldIsVisible,
  pruneHiddenAttributes,
} from "@bhavano/types/categoryFields";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { updateListingAction } from "@/app/actions/listings";
import { clampDigits, MAX_PRICE, PRICE_MAX_DIGITS, TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

function attributesToStrings(
  attributes: Record<string, unknown>,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(attributes)) {
    result[key] = Array.isArray(value)
      ? value.map(String)
      : value === null || value === undefined
        ? ""
        : String(value);
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
  const [price, setPrice] = useState(
    String(listing.price).replace(/[^0-9]/g, ""),
  );
  const [priceQualifier, setPriceQualifier] = useState(listing.priceQualifier);
  const [specs, setSpecs] = useState(listing.specs.join(", "));
  const [attributes, setAttributes] = useState<
    Record<string, string | string[]>
  >(attributesToStrings(listing.attributes));
  const [status, setStatus] = useState<ListingStatus>(listing.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fieldConfig = CATEGORY_FIELD_CONFIG[listing.category];
  const visibleFields = fieldConfig.filter((field) =>
    fieldIsVisible(field, listing.transactionType, attributes),
  );
  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  // Only currently-visible required fields block saving — a required field hidden behind an
  // unmet `dependsOn` (none today, but the config allows it) can't be filled in anyway.
  const requiredAttributesFilled = visibleFields.every((field) => {
    if (!field.required) return true;
    const value = attributes[field.key];
    return Array.isArray(value) ? value.length > 0 : (value ?? "").length > 0;
  });
  const valid =
    priceValue > 0 && title.trim().length > 0 && requiredAttributesFilled;

  // The stored value may not appear in today's fixed option list (legacy free-text data from
  // before this dropdown existed) — keep it selectable rather than silently swapping it out.
  const priceQualifierOptions = getPriceQualifierOptions(
    listing.category,
    listing.transactionType,
  );
  const priceQualifierChoices = priceQualifierOptions.some(
    (opt) => opt.value === priceQualifier,
  )
    ? priceQualifierOptions
    : [
        {
          value: priceQualifier,
          label: priceQualifier ? `"${priceQualifier}" (current)` : "(none)",
        },
        ...priceQualifierOptions,
      ];

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateListingAction(listing.id, {
      title: title.trim(),
      price: priceValue,
      priceQualifier,
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
    <div className="max-w-[480px] flex flex-col gap-5">
      <div>
        <label className={labelClass}>Category / transaction</label>
        <div className={readOnlyClass}>
          {listing.category} · {listing.transactionType}
        </div>
      </div>

      <div>
        <label className={labelClass}>Title *</label>
        <input
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
          className={inputClass}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>Price (₹) *</label>
          <input
            type="number"
            min={1}
            value={price}
            max={MAX_PRICE}
            inputMode="numeric"
            onChange={(e) => setPrice(clampDigits(sanitizeNonNegative(e.target.value), PRICE_MAX_DIGITS))}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>Price qualifier *</label>
          <select
            value={priceQualifier}
            onChange={(e) => setPriceQualifier(e.target.value)}
            className={inputClass}
          >
            {priceQualifierChoices.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Specs (comma-separated)</label>
        <input
          value={specs}
          onChange={(e) => setSpecs(e.target.value)}
          className={inputClass}
        />
      </div>

      {fieldConfig.length > 0 && (
        <div className="border-t border-border pt-4 flex flex-col gap-4">
          {visibleFields.map((field, index) => (
            <div key={field.key}>
              {field.section &&
                (index === 0 ||
                  visibleFields[index - 1].section !== field.section) && (
                  <div className="text-[13px] font-bold text-text mt-2">
                    {SECTION_LABELS[field.section]}
                  </div>
                )}
              <label className={labelClass}>
                {field.label}
                {field.required ? " *" : ""}
              </label>
              {field.type === "multi-select" ? (
                <select
                  multiple
                  value={
                    Array.isArray(attributes[field.key])
                      ? attributes[field.key]
                      : []
                  }
                  onChange={(e) =>
                    setAttributes((prev) => ({
                      ...prev,
                      [field.key]: Array.from(
                        e.target.selectedOptions,
                        (option) => option.value,
                      ),
                    }))
                  }
                  className={inputClass}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "select" ? (
                <select
                  value={
                    typeof attributes[field.key] === "string"
                      ? attributes[field.key]
                      : ""
                  }
                  onChange={(e) =>
                    setAttributes((prev) =>
                      pruneHiddenAttributes(
                        listing.category,
                        listing.transactionType,
                        { ...prev, [field.key]: e.target.value },
                      ),
                    )
                  }
                  className={inputClass}
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
                  min={field.type === "number" ? (field.min ?? 0) : undefined}
                  value={
                    typeof attributes[field.key] === "string"
                      ? attributes[field.key]
                      : ""
                  }
                  onChange={(e) =>
                    setAttributes((prev) => ({
                      ...prev,
                      [field.key]:
                        field.type === "number"
                          ? sanitizeNonNegative(e.target.value)
                          : e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <label className={labelClass}>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ListingStatus)}
          className={inputClass}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p
          className={`text-[13px] m-0 ${message.type === "success" ? "text-green" : "text-[#b3413a]"}`}
        >
          {message.text}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving || !valid}
        className={`${saveButtonClass} ${saving || !valid ? "opacity-60" : "opacity-100"}`}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const labelClass =
  "block text-xs font-bold text-muted mb-1.5 uppercase tracking-[0.02em]";

const inputClass =
  "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";

const readOnlyClass =
  "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm bg-surface-alt text-text-soft";

const saveButtonClass =
  "bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer";
