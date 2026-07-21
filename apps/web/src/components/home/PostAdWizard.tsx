"use client";

import { useRef, useState } from "react";
import type { Area, City, ListingCategory, TransactionType } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { createListingAction, uploadPhotoAction } from "@/app/actions/listings";
import { searchAreasAction } from "@/app/actions/locations";
import { useClickOutside } from "@/lib/useClickOutside";

function sanitizeNonNegative(value: string): string {
  return value.replace(/-/g, "");
}

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

const CATEGORIES: { value: ListingCategory; label: string; icon: string }[] = [
  { value: "house", label: "House", icon: "🏡" },
  { value: "apartment", label: "Apartment", icon: "🏢" },
  { value: "villa", label: "Villa", icon: "🏘️" },
  { value: "plot", label: "Plot", icon: "🗺️" },
  { value: "pg", label: "PG / Hostel", icon: "🛏️" },
  { value: "storage", label: "Storage space", icon: "📦" },
  { value: "coworking", label: "Coworking", icon: "💼" },
  { value: "commercial", label: "Commercial space", icon: "🏬" },
  { value: "furniture", label: "Furniture", icon: "🛋️" },
  { value: "interiors", label: "Interiors", icon: "🎨" },
];

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sell: "Sell",
  buy: "Buy",
  rent: "Rent out",
  lease: "Lease out",
};

type Step = "category" | "transactionType" | "details" | "review";

const fieldClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";

const labelClass = "text-[13px] font-bold text-text-soft mb-1.5 block";

function RequiredLabel({ text }: { text: string }) {
  return (
    <label className={labelClass}>
      {text} <span className="text-[#b3413a]">*</span>
    </label>
  );
}

const optionButtonClass = (active: boolean) =>
  `flex items-center gap-2.5 w-full text-left border-[1.5px] rounded-[10px] px-4 py-3.5 text-sm font-bold text-text cursor-pointer ${
    active ? "border-green bg-surface-alt" : "border-border bg-surface"
  }`;

const backButtonClass = "bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer";

export function PostAdWizard({ cities, defaultCityId }: { cities: City[]; defaultCityId?: string }) {
  const [listingId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  const [title, setTitle] = useState("");
  const [cityId, setCityId] = useState(defaultCityId ?? cities[0]?.id ?? "");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<Area[]>([]);
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const areaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaFieldRef = useRef<HTMLDivElement | null>(null);
  const [specs, setSpecs] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useClickOutside(areaFieldRef, () => setShowAreaSuggestions(false));

  function selectCategory(next: ListingCategory) {
    setCategory(next);
    setAttributes({});
    const postable = POSTABLE_TRANSACTION_TYPES[next];
    if (postable.length === 1) {
      setTransactionType(postable[0]);
      setPriceQualifier(getPriceQualifierOptions(next, postable[0])[0]?.value ?? "");
      setStep("details");
    } else {
      setTransactionType(null);
      setPriceQualifier("");
      setStep("transactionType");
    }
  }

  function selectTransactionType(next: TransactionType) {
    setTransactionType(next);
    setPriceQualifier(category ? getPriceQualifierOptions(category, next)[0]?.value ?? "" : "");
    setStep("details");
  }

  function onPhotosSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_PHOTOS - photos.length;
    const candidates = Array.from(files).slice(0, room);
    if (files.length > room) {
      setError(`Up to ${MAX_PHOTOS} photos allowed — only added the first ${room}.`);
    }

    const accepted: SelectedPhoto[] = [];
    for (const file of candidates) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        setError(`"${file.name}" isn't a supported format — use JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setError(`"${file.name}" is over the 4MB limit.`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function onRemovePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function onAreaQueryChange(value: string) {
    setAreaQuery(value);
    setAreaId(null);
    setShowAreaSuggestions(true);

    if (areaDebounceRef.current) clearTimeout(areaDebounceRef.current);
    if (!value.trim() || !cityId) {
      setAreaSuggestions([]);
      return;
    }
    areaDebounceRef.current = setTimeout(async () => {
      setAreaSuggestions(await searchAreasAction(cityId, value));
    }, 300);
  }

  function onPickArea(a: Area) {
    setAreaQuery(a.name);
    setAreaId(a.id);
    setAreaSuggestions([]);
    setShowAreaSuggestions(false);
  }

  function onCityChange(newCityId: string) {
    setCityId(newCityId);
    setAreaQuery("");
    setAreaId(null);
    setAreaSuggestions([]);
  }

  const requiredAttributesFilled = category
    ? CATEGORY_FIELD_CONFIG[category].every((field) => !field.required || (attributes[field.key] ?? "").length > 0)
    : true;

  const detailsValid =
    Number(price) > 0 &&
    title.length > 0 &&
    areaQuery.trim().length > 0 &&
    !!cityId &&
    photos.length > 0 &&
    requiredAttributesFilled;

  async function onSubmit() {
    if (!category || !transactionType) return;
    setPending(true);
    setError(null);

    const uploadedPhotos: { photoNo: number; hash: string; ext: string }[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photoNo = i + 1;
      const formData = new FormData();
      formData.set("file", photos[i].file);
      formData.set("listingId", listingId);
      formData.set("photoNo", String(photoNo));
      const uploadResult = await uploadPhotoAction(formData);
      if (uploadResult.error || !uploadResult.hash || !uploadResult.ext) {
        setError(uploadResult.error ?? "Failed to upload a photo");
        setPending(false);
        return;
      }
      uploadedPhotos.push({ photoNo, hash: uploadResult.hash, ext: uploadResult.ext });
    }

    const result = await createListingAction({
      id: listingId,
      category,
      transactionType,
      price: Number(price),
      priceQualifier: priceQualifier || undefined,
      title,
      areaId: areaId ?? undefined,
      areaName: areaId ? undefined : areaQuery.trim(),
      cityId,
      specs: specs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      photos: uploadedPhotos,
      attributes,
    });

    // createListingAction redirects on success; reaching here means it failed.
    setPending(false);
    if (result && !result.success) setError(result.error ?? "Failed to create listing");
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-6 text-xs font-bold text-muted">
        {(["category", "transactionType", "details", "review"] as Step[]).map((s, i) => (
          <span key={s} className={step === s ? "text-green" : "text-muted"}>
            {i > 0 && " → "}
            {i + 1}. {s === "category" ? "Category" : s === "transactionType" ? "Transaction" : s === "details" ? "Details" : "Review"}
          </span>
        ))}
      </div>

      {step === "category" && (
        <div className="grid grid-cols-3 gap-2.5">
          {CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => selectCategory(c.value)} className={optionButtonClass(category === c.value)}>
              <span className="text-lg">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {step === "transactionType" && category && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            {POSTABLE_TRANSACTION_TYPES[category].map((t) => (
              <button key={t} onClick={() => selectTransactionType(t)} className={optionButtonClass(transactionType === t)}>
                {TRANSACTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <button onClick={() => setStep("category")} className={`${backButtonClass} mt-1`}>
            ← Back
          </button>
        </div>
      )}

      {step === "details" && category && transactionType && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <RequiredLabel text="Price (₹)" />
              <input
                type="number"
                required
                min={1}
                value={price}
                onChange={(e) => setPrice(sanitizeNonNegative(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="flex-1">
              <RequiredLabel text="Price qualifier" />
              <select value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)} className={fieldClass}>
                {getPriceQualifierOptions(category, transactionType).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <RequiredLabel text="Title" />
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <RequiredLabel text="City" />
            <select required value={cityId} onChange={(e) => onCityChange(e.target.value)} className={fieldClass}>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div ref={areaFieldRef} className="relative">
            <RequiredLabel text="Area / locality" />
            <input
              required
              value={areaQuery}
              onChange={(e) => onAreaQueryChange(e.target.value)}
              onFocus={() => setShowAreaSuggestions(true)}
              placeholder="Start typing a locality…"
              autoComplete="off"
              className={fieldClass}
            />
            {showAreaSuggestions && areaSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-surface border border-border rounded-[9px] mt-1 max-h-[220px] overflow-y-auto">
                {areaSuggestions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onPickArea(a)}
                    className="block w-full text-left bg-transparent border-0 px-3.5 py-2.5 text-sm text-text cursor-pointer"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
            {!areaId && areaQuery.trim() && (
              <p className="text-xs text-muted mt-1.5">
                No match selected — &quot;{areaQuery.trim()}&quot; will be added as a new area.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Specs (comma-separated, shown on the listing card)</label>
            <input value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="3 Beds, 1450 sqft" className={fieldClass} />
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-[13px] font-bold text-text mb-3">
              {CATEGORIES.find((c) => c.value === category)?.label} details
            </div>
            <div className="flex flex-col gap-4">
              {CATEGORY_FIELD_CONFIG[category].map((field) => (
                <div key={field.key}>
                  {field.required ? <RequiredLabel text={field.label} /> : <label className={labelClass}>{field.label}</label>}
                  {field.type === "select" ? (
                    <select
                      value={attributes[field.key] ?? ""}
                      onChange={(e) => setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))}
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
                      className={fieldClass}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <RequiredLabel text={`Photos (up to ${MAX_PHOTOS})`} />
            {photos.length < MAX_PHOTOS && (
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => {
                  onPhotosSelected(e.target.files);
                  e.target.value = "";
                }}
              />
            )}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-2.5">
                {photos.map((photo, i) => (
                  <div key={photo.previewUrl} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.previewUrl} alt={`Photo ${i + 1}`} className="h-[100px] w-[100px] object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full border-0 bg-surface text-[#b3413a] font-bold cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="text-[#b3413a] text-[13px] mt-2">{error}</p>}
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => setStep(POSTABLE_TRANSACTION_TYPES[category].length === 1 ? "category" : "transactionType")}
              className={backButtonClass}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!detailsValid}
              className={`ml-auto bg-green text-on-green border-0 rounded-lg px-6 py-3 text-sm font-bold cursor-pointer ${
                detailsValid ? "opacity-100" : "opacity-50"
              }`}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === "review" && category && transactionType && (
        <div className="flex flex-col gap-3">
          <div className="border border-border rounded-[10px] p-4 text-sm text-text">
            <p className="m-0 mb-1.5">
              <strong>{CATEGORIES.find((c) => c.value === category)?.label}</strong> — {TRANSACTION_TYPE_LABELS[transactionType]}
            </p>
            <p className="m-0 mb-1.5">{title}</p>
            <p className="m-0 mb-1.5 text-muted">
              {areaQuery}, {cities.find((c) => c.id === cityId)?.name}
            </p>
            <p className="m-0 text-green font-bold">
              ₹{price} {priceQualifier}
            </p>
          </div>

          {error && <p className="text-[#b3413a] text-[13px]">{error}</p>}

          <div className="flex gap-2.5">
            <button
              onClick={() => setStep("details")}
              className={backButtonClass}
            >
              ← Back
            </button>
            <button
              onClick={onSubmit}
              disabled={pending}
              className={`ml-auto bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold cursor-pointer ${
                pending ? "opacity-60" : "opacity-100"
              }`}
            >
              {pending ? "Posting…" : "Post ad"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
