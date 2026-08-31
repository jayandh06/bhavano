"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Area,
  City,
  ListingCategory,
  ListingDetailDto,
  ReverseGeocodeResultDto,
  TransactionType,
} from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, defaultAttributesFor, fieldIsVisible } from "@bhavano/types/categoryFields";
import { clampPrice, maxPriceFor, TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { POST_CATEGORIES, POST_CATEGORY_GROUPS } from "@bhavano/types/postCategories";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import type { VideoEntitlement } from "@bhavano/types/videoLimits";
import { MAX_VIDEO_BYTES } from "@bhavano/types/videoLimits";
import { createListingAction, uploadPhotoAction } from "@/app/actions/listings";
import { CategoryFieldsAccordion } from "@/components/home/CategoryFieldsAccordion";
import { ListingSlotCapPrompt } from "@/components/home/ListingSlotCapPrompt";
import type { ListingSlotCapErrorBody } from "@bhavano/types/listingSlots";
import { searchAreasAction } from "@/app/actions/locations";
import { useClickOutside } from "@/lib/useClickOutside";
import { pushDataLayerEvent } from "@/lib/gtm";
import { buildListingPath } from "@/lib/listingPath";
import {
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/formStyles";
import { uploadVideoDirect } from "@/lib/videoUpload";
import { BoostButton } from "./BoostButton";
import { LocationMapPicker } from "./LocationMapPicker";
import { SelectField } from "./SelectField";
import { VideoManager } from "./VideoManager";


const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/x-matroska",
];

interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

interface SelectedVideo {
  file: File;
  previewUrl: string;
  /** Read client-side via a hidden <video> element — a courtesy pre-check only. `undefined` means
   * the browser couldn't determine it (happens with some WebM/HEVC sources); the file is still
   * allowed through in that case and the server's ffprobe check is the real authority. */
  durationSec?: number;
}

/** Best-effort client-side duration read — resolves `undefined` rather than rejecting on any
 * failure, since a browser parsing quirk shouldn't block a possibly-valid file (see
 * SelectedVideo.durationSec doc comment). */
function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : undefined,
      );
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    el.src = url;
  });
}

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sell: "Sell",
  buy: "Buy",
  rent: "Rent out",
  lease: "Lease out",
};

type Step = "category" | "transactionType" | "details" | "review" | "success";

/**
 * One `post_step_view` per step the user actually reaches.
 *
 * Where people give up is the whole question on this page, and the only event fired until now was
 * `post_ad_success` — so a drop-off was visible in aggregate but never locatable. Fired on
 * arrival at a step rather than on the button that leaves the previous one, so a step reached by
 * the Back button counts the same as one reached going forward.
 */
function StepTracker({ step }: { step: Step }) {
  useEffect(() => {
    pushDataLayerEvent("post_step_view", { step });
  }, [step]);
  return null;
}

function RequiredLabel({ text }: { text: string }) {
  return (
    <label className={labelClass}>
      {text} <span className="text-[#b3413a]">*</span>
    </label>
  );
}

/**
 * The photo and video pickers.
 *
 * A dashed border reads as "drop or choose something here" rather than as a filled button
 * competing with Continue, and the full-width tap target matters more on a phone than the few
 * pixels it costs on desktop.
 *
 * Drag-and-drop needs no capability test. A phone fires no drag events, so the handlers simply
 * never run there — only the "or drag them here" hint is hidden below sm, since it would be
 * advice a touch user cannot follow. `onDragOver` must preventDefault or the browser navigates
 * to the dropped file instead of handing it over, which is the failure everyone hits first.
 */
function UploadZone({
  accept,
  multiple = true,
  onFiles,
  icon,
  label,
  hint,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
  icon: string;
  label: string;
  hint: string;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-1.5 w-full border-[1.5px] border-dashed rounded-xl px-4 py-6 cursor-pointer text-center transition-colors ${
        dragging ? "border-green bg-green/10" : "border-green bg-surface-alt"
      }`}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-sm font-bold text-green">
        {dragging ? "Drop to add" : label}
      </span>
      <span className="text-xs text-muted">
        {hint}
        <span className="hidden sm:inline"> · or drag them here</span>
      </span>
    </label>
  );
}

const optionButtonClass = (active: boolean) =>
  `flex items-center gap-2.5 w-full text-left border-[1.5px] rounded-[10px] px-4 py-3.5 text-sm font-bold text-text cursor-pointer ${
    active ? "border-green bg-surface-alt" : "border-border bg-surface"
  }`;

export function PostAdWizard({
  cities: initialCities,
  defaultCityId,
  accessToken,
  videoEntitlement,
}: {
  cities: City[];
  defaultCityId?: string;
  accessToken: string;
  videoEntitlement: VideoEntitlement;
}) {
  const [listingId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] =
    useState<TransactionType | null>(null);

  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  const [title, setTitle] = useState("");
  // Grows when the map picker's reverse-geocode resolves to a just-created city (not in this
  // initially-fetched list) — see `onPinChange` below.
  const [cities, setCities] = useState<City[]>(initialCities);
  const [cityId, setCityId] = useState(
    defaultCityId ?? initialCities[0]?.id ?? "",
  );
  const [areaQuery, setAreaQuery] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<Area[]>([]);
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const areaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaFieldRef = useRef<HTMLDivElement | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [specs, setSpecs] = useState("");
  const [attributes, setAttributes] = useState<
    Record<string, string | string[]>
  >({});
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [videos, setVideos] = useState<SelectedVideo[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotCap, setSlotCap] = useState<ListingSlotCapErrorBody | null>(null);
  const [createdListing, setCreatedListing] = useState<ListingDetailDto | null>(
    null,
  );
  // Informational, non-blocking note about the map pin's reverse-geocode result — either "we
  // added this city for you" or "couldn't confidently place this pin" (see `onPinChange`).
  const [pinLookupNote, setPinLookupNote] = useState<string | null>(null);

  useClickOutside(areaFieldRef, () => setShowAreaSuggestions(false));

  function selectCategory(next: ListingCategory) {
    setCategory(next);
    setAttributes(defaultAttributesFor(next));
    const postable = POSTABLE_TRANSACTION_TYPES[next];
    if (postable.length === 1) {
      setTransactionType(postable[0]);
      setPriceQualifier(
        getPriceQualifierOptions(next, postable[0])[0]?.value ?? "",
      );
      setStep("details");
    } else {
      setTransactionType(null);
      setPriceQualifier("");
      setStep("transactionType");
    }
  }

  function selectTransactionType(next: TransactionType) {
    setTransactionType(next);
    setPriceQualifier(
      category
        ? (getPriceQualifierOptions(category, next)[0]?.value ?? "")
        : "",
    );
    setStep("details");
  }

  function onPhotosSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_PHOTOS - photos.length;
    const candidates = Array.from(files).slice(0, room);
    if (files.length > room) {
      setError(
        `Up to ${MAX_PHOTOS} photos allowed — only added the first ${room}.`,
      );
    }

    const accepted: SelectedPhoto[] = [];
    for (const file of candidates) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        setError(
          `"${file.name}" isn't a supported format — use JPEG, PNG, WebP, or GIF.`,
        );
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

  async function onVideosSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setVideoError(null);

    const room = videoEntitlement.maxVideos - videos.length;
    const candidates = Array.from(files).slice(0, room);
    if (files.length > room) {
      setVideoError(
        room <= 0
          ? videoEntitlement.canUpgradeByBoosting
            ? `You've reached the ${videoEntitlement.maxVideos}-video limit. Boost this listing after posting to add more.`
            : `Up to ${videoEntitlement.maxVideos} videos allowed.`
          : `Up to ${videoEntitlement.maxVideos} videos allowed — only added the first ${room}.`,
      );
    }

    for (const file of candidates) {
      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        setVideoError(`"${file.name}" isn't a supported video format.`);
        continue;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setVideoError(
          `"${file.name}" is over the ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB limit.`,
        );
        continue;
      }
      // A courtesy check only — the server verifies actual duration via ffprobe regardless (see
      // readVideoDuration's doc comment for why an indeterminate result doesn't block the file).
      const durationSec = await readVideoDuration(file);
      if (
        durationSec !== undefined &&
        durationSec > videoEntitlement.maxDurationSec
      ) {
        setVideoError(
          videoEntitlement.canUpgradeByBoosting
            ? `"${file.name}" is longer than ${videoEntitlement.maxDurationSec}s. Boost this listing after posting to add longer videos.`
            : `"${file.name}" is longer than the ${videoEntitlement.maxDurationSec}s limit.`,
        );
        continue;
      }
      setVideos((prev) => [
        ...prev,
        { file, previewUrl: URL.createObjectURL(file), durationSec },
      ]);
    }
  }

  function onRemoveVideo(index: number) {
    setVideos((prev) => {
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

  /** Google's City/Area resolution is a suggestion, never auto-locked — the user can still
   * change the City select / Area field manually after the map pre-fills them. A city/area with
   * no existing match gets created on the fly (see LocationsService.ensureCity/ensureArea in the
   * BFF) rather than silently left unresolved — this list only needs to grow to *display* one
   * that's not in the initially-fetched set, since it already exists in the DB by this point. */
  function onPinChange(
    nextPin: { lat: number; lng: number },
    suggestion: ReverseGeocodeResultDto | null,
  ) {
    setPin(nextPin);
    if (!suggestion) return;

    if (suggestion.cityId) {
      setCities((prev) =>
        prev.some((c) => c.id === suggestion.cityId)
          ? prev
          : [
              ...prev,
              {
                id: suggestion.cityId!,
                name: suggestion.cityName ?? suggestion.resolvedLocality,
                state: "",
                lat: nextPin.lat,
                lng: nextPin.lng,
                isPopular: false,
              },
            ],
      );
      onCityChange(suggestion.cityId);
      setPinLookupNote(
        suggestion.isNewCity
          ? `We've added ${suggestion.cityName ?? "this city"} as a new city on Bhavano!`
          : null,
      );
    } else {
      setPinLookupNote(
        "Couldn't confidently match a city here — please pick City/Area manually below.",
      );
    }

    if (suggestion.areaId && suggestion.resolvedLocality) {
      setAreaId(suggestion.areaId);
      setAreaQuery(suggestion.resolvedLocality);
      setAreaSuggestions([]);
    }
  }

  const visibleFields = category
    ? CATEGORY_FIELD_CONFIG[category].filter((field) =>
        fieldIsVisible(field, transactionType!, attributes),
      )
    : [];
  // Only currently-visible required fields block submission — a required field hidden behind
  // an unmet `dependsOn` (none today, but the config allows it) can't be filled in anyway.
  const requiredAttributesFilled = visibleFields.every((field) => {
    if (!field.required) return true;
    const value = attributes[field.key];
    return Array.isArray(value)
      ? value.length > 0
      : (value ?? "").length > 0;
  });

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
      uploadedPhotos.push({
        photoNo,
        hash: uploadResult.hash,
        ext: uploadResult.ext,
      });
    }

    // Video never blocks the post — if a single upload fails, drop it and continue rather than
    // aborting the whole submission the way a failed photo upload does (photos are required,
    // video is additive). ListingsService.create() also re-validates and silently trims against
    // the caller's current entitlement, so this array is best-effort even before it gets there.
    const uploadedVideos: {
      storageId: string;
      ext: string;
      durationSec: number;
      sizeBytes: number;
    }[] = [];
    for (const video of videos) {
      try {
        uploadedVideos.push(
          await uploadVideoDirect(video.file, listingId, accessToken),
        );
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload a video",
        );
      }
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
      videos: uploadedVideos.length > 0 ? uploadedVideos : undefined,
      attributes,
      lat: pin?.lat,
      lng: pin?.lng,
    });

    setPending(false);
    if (!result.success) {
      setSlotCap(result.slotCap ?? null);
      setError(result.error ?? "Failed to create listing");
      return;
    }
    setSlotCap(null);
    // Fired here (not on the listing page) so it's guaranteed to happen exactly once, even if
    // the user boosts, skips, or closes the tab without ever navigating to their new listing.
    pushDataLayerEvent("post_ad_success", { listingId: result.listing.id });
    setCreatedListing(result.listing);
    setStep("success");
  }

  return (
    <div>
      <StepTracker step={step} />
      {step !== "success" && (
        <div className="flex gap-1.5 mb-6 text-xs font-bold text-muted">
          {(["category", "transactionType", "details", "review"] as Step[]).map(
            (s, i) => (
              <span
                key={s}
                className={step === s ? "text-green" : "text-muted"}
              >
                {i > 0 && " → "}
                {i + 1}.{" "}
                {s === "category"
                  ? "Category"
                  : s === "transactionType"
                    ? "Transaction"
                    : s === "details"
                      ? "Details"
                      : "Review"}
              </span>
            ),
          )}
        </div>
      )}

      {step === "category" && (
        <div className="flex flex-col gap-6">
          {POST_CATEGORY_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[13px] font-bold text-text-soft uppercase tracking-wide m-0 mb-2.5">{group.title}</h3>
              {/* Two columns on a phone, three from sm up. Three fixed columns left roughly 100px
                * per tile at 360px, which "Commercial space" and "Storage space" cannot fit. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {group.options.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => selectCategory(c.value)}
                    className={optionButtonClass(category === c.value)}
                  >
                    <span className="text-lg shrink-0">{c.icon}</span>
                    <span className="min-w-0">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === "transactionType" && category && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            {POSTABLE_TRANSACTION_TYPES[category].map((t) => (
              <button
                key={t}
                onClick={() => selectTransactionType(t)}
                className={optionButtonClass(transactionType === t)}
              >
                {TRANSACTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep("category")}
            className={`${secondaryButtonClass} mt-1`}
          >
            ← Back
          </button>
        </div>
      )}

      {step === "details" && category && transactionType && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <RequiredLabel text="Title" />
              {/* Counts up rather than down, so it reads as progress rather than a warning, and
                * turns amber near the cap instead of only at it — a poster who has run out of
                * room mid-sentence wants to know a few characters earlier. */}
              <span
                className={`text-xs tabular-nums ${title.length >= TITLE_MAX_LENGTH ? "text-[#b3413a]" : title.length > TITLE_MAX_LENGTH - 20 ? "text-gold" : "text-muted"}`}
              >
                {title.length}/{TITLE_MAX_LENGTH}
              </span>
            </div>
            <input
              required
              value={title}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
              className={`${fieldClass} max-w-[720px]`}
            />
          </div>

          <div>
            <label className={labelClass}>
              Pin your exact location (optional — helps buyers find you, and
              auto-fills City/Area below)
            </label>
            <LocationMapPicker
              defaultCenter={
                cities.find((c) => c.id === cityId) ??
                cities[0] ?? { lat: 20.5937, lng: 78.9629 }
              }
              onPinChange={onPinChange}
            />
            {pinLookupNote && (
              <p className="text-xs text-muted mt-1.5">{pinLookupNote}</p>
            )}
          </div>

          <div>
            <RequiredLabel text="City" />
            <SelectField required value={cityId} onChange={(e) => onCityChange(e.target.value)}>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
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
                No match selected — &quot;{areaQuery.trim()}&quot; will be added
                as a new area.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Specs (comma-separated, shown on the listing card)
            </label>
            <input
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              placeholder="3 Beds, 1450 sqft"
              className={fieldClass}
            />
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-[13px] font-bold text-text mb-3">
              {POST_CATEGORIES.find((c) => c.value === category)?.label} details
            </div>
            <CategoryFieldsAccordion
              category={category}
              transactionType={transactionType}
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
                        max={maxPriceFor(transactionType)}
                        inputMode="numeric"
                        value={price}
                        onChange={(e) => setPrice(clampPrice(e.target.value, transactionType))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="flex-1">
                      <RequiredLabel text="Price qualifier" />
                      <SelectField value={priceQualifier} onChange={(e) => setPriceQualifier(e.target.value)}>
                        {getPriceQualifierOptions(category, transactionType).map(
                          (opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ),
                        )}
                      </SelectField>
                    </div>
                  </div>
                ),
              }}
            />
          </div>

          <div>
            <RequiredLabel text={`Photos (up to ${MAX_PHOTOS})`} />
            {photos.length < MAX_PHOTOS && (
              // A styled label wrapping a hidden input rather than a bare <input type="file">.
              // The native control renders as a small grey "Choose files" button that is easy to
              // scroll past — on the one step where skipping it costs the listing most, since an
              // ad with no photo is the one nobody opens.
              <UploadZone
                accept="image/jpeg,image/png,image/webp,image/gif"
                onFiles={onPhotosSelected}
                icon="📷"
                label={photos.length > 0 ? "Add more photos" : "Add photos"}
                hint={`JPG, PNG or WebP · ${MAX_PHOTOS - photos.length} more allowed`}
              />
            )}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-2.5">
                {photos.map((photo, i) => (
                  <div key={photo.previewUrl} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Photo ${i + 1}`}
                      className="h-[100px] w-[100px] object-cover rounded-lg"
                    />
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
            {error && (
              <p className="text-[#b3413a] text-[13px] mt-2">{error}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Video (optional, up to {videoEntitlement.maxVideos})
            </label>
            <p className="text-xs text-muted mt-0.5 mb-1.5">
              Up to {videoEntitlement.maxDurationSec}s each.
              {videoEntitlement.canUpgradeByBoosting &&
                " Boost this listing after posting to add up to 3 videos, up to 2 minutes each."}
            </p>
            {videos.length < videoEntitlement.maxVideos && (
              <UploadZone
                accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska"
                onFiles={(files) => void onVideosSelected(files)}
                icon="🎥"
                label={videos.length > 0 ? "Add another video" : "Add a video"}
                hint={`MP4 or MOV · up to ${videoEntitlement.maxDurationSec}s each`}
              />
            )}
            {videos.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-2.5">
                {videos.map((video, i) => (
                  <div key={video.previewUrl} className="relative">
                    <video
                      src={video.previewUrl}
                      className="h-[100px] w-[100px] object-cover rounded-lg bg-black"
                      muted
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveVideo(i)}
                      className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full border-0 bg-surface text-[#b3413a] font-bold cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {videoError && (
              <p className="text-[#b3413a] text-[13px] mt-2">{videoError}</p>
            )}
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() =>
                setStep(
                  POSTABLE_TRANSACTION_TYPES[category].length === 1
                    ? "category"
                    : "transactionType",
                )
              }
              className={secondaryButtonClass}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!detailsValid}
              className={`ml-auto ${primaryButtonClass}`}
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
              <strong>
                {POST_CATEGORIES.find((c) => c.value === category)?.label}
              </strong>{" "}
              — {TRANSACTION_TYPE_LABELS[transactionType]}
            </p>
            <p className="m-0 mb-1.5">{title}</p>
            <p className="m-0 mb-1.5 text-muted">
              {areaQuery}, {cities.find((c) => c.id === cityId)?.name}
            </p>
            <p className="m-0 text-green font-bold">
              ₹{price} {priceQualifier}
            </p>
          </div>

          {slotCap ? (
            <ListingSlotCapPrompt slotCap={slotCap} />
          ) : error ? (
            <p className="text-[#b3413a] text-[13px]">{error}</p>
          ) : null}

          <div className="flex gap-2.5">
            <button
              onClick={() => setStep("details")}
              className={secondaryButtonClass}
            >
              ← Back
            </button>
            <button
              onClick={onSubmit}
              disabled={pending}
              className={`ml-auto ${primaryButtonClass}`}
            >
              {pending ? "Posting…" : "Post ad"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && createdListing && (
        <div className="flex flex-col gap-4 text-center py-4">
          <div className="text-3xl">🎉</div>
          <div>
            <div className="font-lora text-xl font-bold text-text mb-1.5">
              Your ad is live!
            </div>
            <p className="text-[13px] text-muted m-0">
              Want it seen faster? Boosted ads get a gold ⭐ Featured badge,
              rank ahead of regular listings, and rotate fairly through the top
              slots — plus we&apos;ll notify you the moment someone likes it.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 mt-1">
            <BoostButton
              listingId={createdListing.id}
              category={createdListing.category}
            />
            <VideoManager listing={createdListing} accessToken={accessToken} />
            <Link
              href={buildListingPath(createdListing)}
              className="text-[13px] font-bold text-text-soft"
            >
              Skip for now — view my ad →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
