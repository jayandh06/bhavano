"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible } from "@bhavano/types/categoryFields";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import { areaUnitShortLabel, type AreaUnit } from "@bhavano/types/areaUnit";
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
  const isPendingPublish = listing.publishState === "pending_checkout";
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(
    String(listing.price).replace(/[^0-9]/g, ""),
  );
  const [priceQualifier, setPriceQualifier] = useState(listing.priceQualifier);
  // "Whole price vs price per unit" — see PostAdWizard.tsx's identical toggle for the full
  // reasoning. Category/transactionType are fixed in this form (only admin editing can change
  // them), so unlike the wizard, no reset-on-change is needed here.
  const [priceMode, setPriceMode] = useState<"total" | "perUnit">(listing.priceUnit ? "perUnit" : "total");
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
  const priceUnitAreaField =
    listing.transactionType === "sell" || listing.transactionType === "lease"
      ? fieldConfig.find((field) => field.type === "area")
      : undefined;
  const currentAreaUnit = (attributes[`${priceUnitAreaField?.key}Unit`] as AreaUnit | undefined) ?? "sqft";
  const priceValue = Number(price.replace(/[^0-9.]/g, ""));
  // Only currently-visible required fields block saving — a required field hidden behind an
  // unmet `dependsOn` (none today, but the config allows it) can't be filled in anyway.
  const requiredAttributesFilled = visibleFields.every((field) => {
    if (!field.required) return true;
    const value = attributes[field.key];
    return Array.isArray(value) ? value.length > 0 : (value ?? "").length > 0;
  });
  // 0 is a real, submittable price ("Contact for price") for pg/coworking — see
  // PRICE_ON_REQUEST_CATEGORIES's own doc comment. Every other category still needs a real one.
  const priceOnRequestAllowed = PRICE_ON_REQUEST_CATEGORIES.has(listing.category);
  const valid =
    (priceValue > 0 || priceOnRequestAllowed) && title.trim().length > 0 && requiredAttributesFilled;

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
      priceUnit: priceMode === "perUnit" && priceUnitAreaField ? currentAreaUnit : null,
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
              <div className="flex flex-col gap-3">
                {priceUnitAreaField && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPriceMode("total")}
                      className={`text-[12.5px] font-bold px-3 py-1.5 rounded-md border ${priceMode === "total" ? "border-green bg-green/10 text-text" : "border-border text-muted"}`}
                    >
                      Total price
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceMode("perUnit")}
                      className={`text-[12.5px] font-bold px-3 py-1.5 rounded-md border ${priceMode === "perUnit" ? "border-green bg-green/10 text-text" : "border-border text-muted"}`}
                    >
                      Price per {areaUnitShortLabel(currentAreaUnit, 1)}
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <RequiredLabel text={priceMode === "perUnit" ? `Price per ${areaUnitShortLabel(currentAreaUnit, 1)} (₹)` : "Price (₹)"} />
                    <input
                      type="number"
                      // Native constraints have to agree with `valid` above, or a browser that
                      // enforces them blocks a legitimate "Contact for price" pg/coworking save
                      // that the JS state already allows.
                      required={!priceOnRequestAllowed}
                      min={priceOnRequestAllowed ? 0 : 1}
                      max={priceMode === "perUnit" ? undefined : maxPriceFor(listing.transactionType)}
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
              </div>
            ),
          }}
        />
      </div>

      {/* Photos, then Video, then Status/Save below — same order PostAdWizard.tsx uses for
        * photos/video relative to the rest of the form (right before its own action-button row).
        * Renders even at zero photos — EditListingPhotos' own "+ Add" control is how a listing
        * with none gets its first post-creation photo; the caller must not gate this on
        * photosFull.length. */}
      <div className="max-w-[720px]">
        <EditListingPhotos
          listingId={listing.id}
          title={listing.title}
          photos={listing.photosFull.map((url, i) => ({
            url,
            photoNo: listing.photoNos[i],
            updatedAt: listing.photoUpdatedAts[i],
          }))}
        />
      </div>

      {/* Video add/delete — was previously only reachable from the /my-listings row, not this
        * page. `expanded` matches it to EditListingPhotos' UploadZone-style add control above. */}
      <div className="max-w-[720px]">
        <label className={labelClass}>Videos</label>
        <VideoManager listing={listing} accessToken={accessToken} expanded />
      </div>

      <div className="max-w-[420px]">
        <label className={labelClass}>Status</label>
        <div className="flex flex-wrap gap-2 mb-2">
          <span
            className="text-[11px] font-bold rounded-md px-2 py-0.5 border"
            style={{
              color:
                status === "active" ? "var(--green)" : status === "deactivated" ? "#b3413a" : "var(--muted)",
              borderColor:
                status === "active" ? "var(--green)" : status === "deactivated" ? "#b3413a" : "var(--muted)",
            }}
          >
            {STATUS_OPTIONS.find((o) => o.value === status)?.label.split(" — ")[0] ?? status}
          </span>
          {isPendingPublish && (
            <span className="text-[11px] font-bold rounded-md px-2 py-0.5 border border-[#b3413a] text-[#b3413a]">
              Not live — payment pending
            </span>
          )}
        </div>
        {isPendingPublish && (
          <p className="text-[13px] text-[#b3413a] m-0 mb-2">
            This ad is not visible to buyers until you complete publish checkout on My listings.
          </p>
        )}
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
