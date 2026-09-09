"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible } from "@bhavano/types/categoryFields";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { updateListingAction } from "@/app/actions/listings";
import { clampPrice, maxPriceFor, TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { fieldClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import { SelectField } from "./SelectField";
import { CategoryFieldsAccordion } from "./CategoryFieldsAccordion";
import { EditListingPhotos } from "./EditListingPhotos";
import { VideoManager } from "./VideoManager";

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

// Same small helper PostAdWizard.tsx keeps for itself — not shared/exported there, so this is
// its own copy rather than a cross-file import of a private component.
function RequiredLabel({ text }: { text: string }) {
  return (
    <label className={labelClass}>
      {text} <span className="text-[#b3413a]">*</span>
    </label>
  );
}

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: "active", label: "Active — visible to buyers/renters" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "deactivated", label: "Deactivated — hidden from search" },
];

export function EditListingForm({ listing, accessToken }: { listing: ListingDetailDto; accessToken: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(
    String(listing.price).replace(/[^0-9]/g, ""),
  );
  const [priceQualifier, setPriceQualifier] = useState(listing.priceQualifier);
  const [description, setDescription] = useState(listing.description ?? "");
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
      description: description.trim(),
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
    <div className="flex flex-col gap-4">
      {listing.photosFull.length > 0 && (
        <EditListingPhotos
          listingId={listing.id}
          title={listing.title}
          photos={listing.photosFull.map((url, i) => ({
            url,
            photoNo: listing.photoNos[i],
            updatedAt: listing.photoUpdatedAts[i],
          }))}
        />
      )}

      {/* Video is the one media type a seller can still add after posting — see VideoManager's
        * own doc comment for why photos (unlike video) are immutable post-creation today. Was
        * previously only reachable from the /my-listings row, not this page. */}
      <div>
        <label className={labelClass}>Videos</label>
        <VideoManager listing={listing} accessToken={accessToken} />
      </div>

      <div className="max-w-[420px]">
        <label className={labelClass}>Category / transaction</label>
        <div className={`${fieldClass} bg-surface-alt text-text-soft`}>
          {listing.category} · {listing.transactionType}
        </div>
      </div>

      <div>
        <RequiredLabel text="Title" />
        {/* Counter sits beside the input rather than sharing the label's row — mirrors
          * PostAdWizard's own Title field. */}
        <div className="flex items-center gap-2 max-w-[720px]">
          <input
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
            className={`${fieldClass} flex-1`}
          />
          <span
            className={`text-xs tabular-nums shrink-0 ${title.length >= TITLE_MAX_LENGTH ? "text-[#b3413a]" : title.length > TITLE_MAX_LENGTH - 20 ? "text-gold" : "text-muted"}`}
          >
            {title.length}/{TITLE_MAX_LENGTH}
          </span>
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe the place in your own words — the layout, the neighbourhood, what's nearby."
          className={`${fieldClass} resize-y min-h-[120px] max-w-[720px]`}
        />
      </div>

      {/* Same accordion PostAdWizard.tsx uses for the same CATEGORY_FIELD_CONFIG — Price/Price
        * qualifier fold into the top of "pricing" via sectionExtras rather than sitting outside
        * the grouped sections, matching how the wizard treats them (they're not category-specific
        * fields, but they belong with the rest of "pricing" all the same). */}
      <div>
        <CategoryFieldsAccordion
          category={listing.category}
          transactionType={listing.transactionType}
          attributes={attributes}
          onAttributesChange={setAttributes}
          sectionExtras={{
            pricing: (
              <div className="flex gap-3">
                <div className="flex-1">
                  <RequiredLabel text="Price (₹)" />
                  <input
                    type="number"
                    required
                    min={1}
                    max={maxPriceFor(listing.transactionType)}
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(clampPrice(e.target.value, listing.transactionType))}
                    className={fieldClass}
                  />
                </div>
                <div className="flex-1">
                  <RequiredLabel text="Price qualifier" />
                  <SelectField value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)}>
                    {priceQualifierChoices.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
            ),
          }}
        />
      </div>

      <div className="max-w-[420px]">
        <label className={labelClass}>Status</label>
        <SelectField value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
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
        className={`${primaryButtonClass} self-start`}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
