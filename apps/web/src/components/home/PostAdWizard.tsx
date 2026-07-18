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
  { value: "pg", label: "PG / Hostel", icon: "🛏️" },
  { value: "storage", label: "Storage space", icon: "📦" },
  { value: "coworking", label: "Coworking", icon: "💼" },
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

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text-soft)",
  marginBottom: 6,
  display: "block",
};

function RequiredLabel({ text }: { text: string }) {
  return (
    <label style={labelStyle}>
      {text} <span style={{ color: "#b3413a" }}>*</span>
    </label>
  );
}

const optionButtonStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  textAlign: "left",
  border: `1.5px solid ${active ? "var(--green)" : "var(--border)"}`,
  background: active ? "var(--surface-alt)" : "var(--surface)",
  borderRadius: 10,
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text)",
  cursor: "pointer",
});

export function PostAdWizard({ cities }: { cities: City[] }) {
  const [listingId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  const [title, setTitle] = useState("");
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
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
      <div style={{ display: "flex", gap: 6, marginBottom: 24, fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
        {(["category", "transactionType", "details", "review"] as Step[]).map((s, i) => (
          <span key={s} style={{ color: step === s ? "var(--green)" : "var(--muted)" }}>
            {i > 0 && " → "}
            {i + 1}. {s === "category" ? "Category" : s === "transactionType" ? "Transaction" : s === "details" ? "Details" : "Review"}
          </span>
        ))}
      </div>

      {step === "category" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => selectCategory(c.value)} style={optionButtonStyle(category === c.value)}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {step === "transactionType" && category && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {POSTABLE_TRANSACTION_TYPES[category].map((t) => (
            <button key={t} onClick={() => selectTransactionType(t)} style={optionButtonStyle(transactionType === t)}>
              {TRANSACTION_TYPE_LABELS[t]}
            </button>
          ))}
          <button
            onClick={() => setStep("category")}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
          >
            ← Back
          </button>
        </div>
      )}

      {step === "details" && category && transactionType && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <RequiredLabel text="Price (₹)" />
              <input
                type="number"
                required
                min={1}
                value={price}
                onChange={(e) => setPrice(sanitizeNonNegative(e.target.value))}
                style={fieldStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <RequiredLabel text="Price qualifier" />
              <select value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)} style={fieldStyle}>
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
            <input required value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
          </div>

          <div>
            <RequiredLabel text="City" />
            <select required value={cityId} onChange={(e) => onCityChange(e.target.value)} style={fieldStyle}>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div ref={areaFieldRef} style={{ position: "relative" }}>
            <RequiredLabel text="Area / locality" />
            <input
              required
              value={areaQuery}
              onChange={(e) => onAreaQueryChange(e.target.value)}
              onFocus={() => setShowAreaSuggestions(true)}
              placeholder="Start typing a locality…"
              autoComplete="off"
              style={fieldStyle}
            />
            {showAreaSuggestions && areaSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  marginTop: 4,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {areaSuggestions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onPickArea(a)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "10px 14px",
                      fontSize: 14,
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
            {!areaId && areaQuery.trim() && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                No match selected — &quot;{areaQuery.trim()}&quot; will be added as a new area.
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle}>Specs (comma-separated, shown on the listing card)</label>
            <input value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="3 Beds, 1450 sqft" style={fieldStyle} />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
              {CATEGORIES.find((c) => c.value === category)?.label} details
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {CATEGORY_FIELD_CONFIG[category].map((field) => (
                <div key={field.key}>
                  {field.required ? <RequiredLabel text={field.label} /> : <label style={labelStyle}>{field.label}</label>}
                  {field.type === "select" ? (
                    <select
                      value={attributes[field.key] ?? ""}
                      onChange={(e) => setAttributes((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      style={fieldStyle}
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
                      style={fieldStyle}
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {photos.map((photo, i) => (
                  <div key={photo.previewUrl} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Photo ${i + 1}`}
                      style={{ height: 100, width: 100, objectFit: "cover", borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(i)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "none",
                        background: "var(--surface)",
                        color: "#b3413a",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && <p style={{ color: "#b3413a", fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStep(POSTABLE_TRANSACTION_TYPES[category].length === 1 ? "category" : "transactionType")}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!detailsValid}
              style={{
                marginLeft: "auto",
                background: "var(--green)",
                color: "var(--on-green)",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: detailsValid ? 1 : 0.5,
              }}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === "review" && category && transactionType && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, fontSize: 14, color: "var(--text)" }}>
            <p style={{ margin: "0 0 6px" }}>
              <strong>{CATEGORIES.find((c) => c.value === category)?.label}</strong> — {TRANSACTION_TYPE_LABELS[transactionType]}
            </p>
            <p style={{ margin: "0 0 6px" }}>{title}</p>
            <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
              {areaQuery}, {cities.find((c) => c.id === cityId)?.name}
            </p>
            <p style={{ margin: 0, color: "var(--green)", fontWeight: 700 }}>
              ₹{price} {priceQualifier}
            </p>
          </div>

          {error && <p style={{ color: "#b3413a", fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStep("details")}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ← Back
            </button>
            <button
              onClick={onSubmit}
              disabled={pending}
              style={{
                marginLeft: "auto",
                background: "var(--green)",
                color: "var(--on-green)",
                border: "none",
                borderRadius: 8,
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? "Posting…" : "Post ad"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
