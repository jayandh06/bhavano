"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  Area,
  BoostPlanSelection,
  City,
  ListingCategory,
  ListingDetailDto,
  ReverseGeocodeResultDto,
  TransactionType,
} from "@bhavano/types";
import { buildDisplayBoostPricing } from "@bhavano/types/boostPricing";
import type { BoostPriceSettings } from "@bhavano/types/boostPricing";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import { CATEGORY_FIELD_CONFIG, defaultAttributesFor, fieldIsVisible } from "@bhavano/types/categoryFields";
import { clampPrice, maxPriceFor, TITLE_MAX_LENGTH } from "@bhavano/types/listingLimits";
import { POST_CATEGORIES, POST_CATEGORY_GROUPS } from "@bhavano/types/postCategories";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import type { VideoEntitlement } from "@bhavano/types/videoLimits";
import { MAX_VIDEO_BYTES } from "@bhavano/types/videoLimits";
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from "@bhavano/types/photoLimits";
import { getAccessTokenAction } from "@/app/actions/auth";
import { getUserContactAction } from "@/app/actions/users";
import { createListingAction, uploadPhotoAction } from "@/app/actions/listings";
import { NEEDS_LOGIN_ERROR } from "@/lib/postAdErrors";
import {
  fetchActiveBoostDiscountPercentAction,
  fetchBoostPricingAction,
  fetchInstantAlertsPricingAction,
} from "@/app/actions/payments";
import { startBoostCheckout } from "@/lib/boostCheckout";
import { useAuthGate } from "./AuthGateProvider";
import { CategoryFieldsAccordion } from "@/components/home/CategoryFieldsAccordion";
import { ListingSlotCapPrompt } from "@/components/home/ListingSlotCapPrompt";
import type { ListingSlotCapErrorBody } from "@bhavano/types/listingSlots";
import { searchAreasAction } from "@/app/actions/locations";
import { useClickOutside } from "@/lib/useClickOutside";
import { pushDataLayerEvent, toE164IN } from "@/lib/gtm";
import { buildListingPath } from "@/lib/listingPath";
import {
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/formStyles";
import { uploadVideoDirect } from "@/lib/videoUpload";
import { BoostBundlePicker } from "./BoostBundlePicker";
import { BoostPlanSelector } from "./BoostPlanSelector";
import { ListingPreviewCard } from "./ListingPreviewCard";
import { LocationMapPicker } from "./LocationMapPicker";
import { SelectField } from "./SelectField";
import { VideoManager } from "./VideoManager";
import { Icon, isIconName } from "./Icon";
import { UploadZone } from "./UploadZone";


// Same fallback BrowseListingsView.tsx uses — buildListingPath is relative, and the "Feedback"
// link below needs a full URL a support agent can open directly, no site context assumed.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

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
 * One `post_step_view` per step the user actually reaches, and resets scroll to the top of the
 * page on every step change.
 *
 * Without the scroll reset, a step reached after scrolling down on the previous one (picking the
 * last category in a long list, say) rendered with the new step's content starting wherever the
 * old scroll position happened to land — often mid-page or past the end of shorter steps, so the
 * next field to fill in was off-screen and easy to miss on a phone. Every step's content is short
 * enough that "back to the top" is always the right place to land, forward or via Back.
 *
 * Where people give up is the whole question on this page, and the only event fired until now was
 * `post_ad_success` — so a drop-off was visible in aggregate but never locatable. Fired on
 * arrival at a step rather than on the button that leaves the previous one, so a step reached by
 * the Back button counts the same as one reached going forward.
 */
function StepTracker({ step }: { step: Step }) {
  useEffect(() => {
    window.scrollTo(0, 0);
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

const optionButtonClass = (active: boolean) =>
  `flex items-center gap-2.5 w-full text-left border-[1.5px] rounded-[10px] px-4 py-3.5 text-sm font-bold text-text cursor-pointer ${
    active ? "border-green bg-surface-alt" : "border-border bg-surface"
  }`;

/** Buy/Sell/Rent/Lease — short, content-sized pills rather than the category step's full-width
 * left-aligned rows above. That layout suits a longer label sitting beside an icon; these are
 * one or two words with nothing else in the button, so stretching them edge-to-edge the same way
 * just left-anchored 2-of-3 grid cells for any category with fewer than three options (storage,
 * coworking, furniture) rather than reading as a deliberate row. Sized to content instead, in a
 * plain flex-start row — left-aligned like the rest of the wizard's steps, just no longer
 * stretched into empty grid columns that were never there for a two-option category. */
const transactionButtonClass = (active: boolean) =>
  `text-center border-[1.5px] rounded-[10px] px-5 py-2.5 text-sm font-bold text-text cursor-pointer min-w-[112px] ${
    active ? "border-green bg-surface-alt" : "border-border bg-surface"
  }`;

export function PostAdWizard({
  cities: initialCities,
  defaultCityId,
  accessToken,
  loggedIn,
  videoEntitlement,
}: {
  cities: City[];
  defaultCityId?: string;
  /** Undefined for a logged-out visitor, who now gets the whole form — see `onSubmit`. */
  accessToken?: string;
  loggedIn: boolean;
  videoEntitlement: VideoEntitlement;
}) {
  const { requireLogin } = useAuthGate();
  const [listingId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("category");
  // Held in state as well as taken as a prop: after a login at submit, the prop is still the
  // undefined this mounted with until router.refresh() lands, which is later than the resumed
  // upload needs it. Whichever arrives first wins.
  const [token, setToken] = useState<string | undefined>(accessToken);
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
  const [description, setDescription] = useState("");
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
  // Public, no-login-required settings (fetchBoostPricingAction/fetchInstantAlertsPricingAction,
  // both already used elsewhere for exactly this reason) — read as soon as the wizard mounts, not
  // gated on being logged in, since the Preview-step selector below has to work before onSubmit's
  // own deliberate first login prompt. previewBoostPricingAction (used by BoostBundlePicker post-
  // creation) requires a session and would force a premature login — see
  // docs/plans/boost-instant-alerts-preview-selector.md.
  const [planPricingSettings, setPlanPricingSettings] = useState<{
    boost: BoostPriceSettings;
    instantAlerts: InstantAlertsPriceSettings;
    activeDiscountPercent: number | null;
  } | null>(null);
  // A boost/instant-alerts choice made ahead of time on the review step — null means the
  // advertiser explicitly skipped it (see selectCategory's pre-fill and BoostPlanSelector's own
  // "Skip" affordance). Only ever read/acted on when previewBoostDisplay?.showSelectorOnPreview.
  const [selectedBoostPlan, setSelectedBoostPlan] = useState<BoostPlanSelection | null>(null);
  // null until a checkout attempt (auto-fired right after posting, or a manual retry) resolves —
  // drives the narrow "Finish boosting this listing" retry prompt on the success step.
  const [boostCheckoutOutcome, setBoostCheckoutOutcome] = useState<"succeeded" | "failed" | null>(null);
  const boostAutoFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBoostPricingAction(), fetchInstantAlertsPricingAction(), fetchActiveBoostDiscountPercentAction()])
      .then(([boost, instantAlerts, activeDiscountPercent]) => {
        if (!cancelled) setPlanPricingSettings({ boost, instantAlerts, activeDiscountPercent });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const previewBoostDisplay = useMemo(
    () =>
      category && planPricingSettings
        ? buildDisplayBoostPricing(
            category,
            planPricingSettings.boost,
            planPricingSettings.instantAlerts,
            planPricingSettings.activeDiscountPercent,
          )
        : null,
    [category, planPricingSettings],
  );

  // Derived, not its own state: true from the moment the listing exists (with a plan selected)
  // until a checkout attempt resolves one way or the other. Keeping this derived rather than a
  // separately-set boolean avoids a synchronous setState at the top of the effect below, which
  // the lint rule below it exists to catch (react-hooks/set-state-in-effect).
  const boostCheckoutInFlight = !!(
    createdListing &&
    selectedBoostPlan &&
    previewBoostDisplay?.showSelectorOnPreview &&
    boostCheckoutOutcome === null
  );

  // Fires once, right after the listing actually exists, using whatever was chosen on the review
  // step — the real in-app/embedded Razorpay checkout (web has no iOS-style App Store constraint).
  useEffect(() => {
    if (boostAutoFiredRef.current) return;
    if (!createdListing || !category || !selectedBoostPlan) return;
    if (!previewBoostDisplay?.showSelectorOnPreview) return;
    boostAutoFiredRef.current = true;

    startBoostCheckout({
      listingId: createdListing.id,
      category,
      duration: selectedBoostPlan.duration,
      includeInstantAlerts: selectedBoostPlan.includeInstantAlerts,
    }).then((result) => {
      setBoostCheckoutOutcome(result.outcome === "activated" || result.outcome === "paid" ? "succeeded" : "failed");
    });
  }, [createdListing, category, selectedBoostPlan, previewBoostDisplay]);

  // Manual retry for the narrow success-step prompt — same call the auto-fire above makes,
  // re-run against the same pre-made selection (a fresh Razorpay order, same as re-clicking
  // BoostBundlePicker's own button already does today). Resetting the outcome to null here is
  // what makes boostCheckoutInFlight true again — this runs from a click handler, not an effect,
  // so no purity-lint concern.
  function retryBoostCheckout() {
    if (!createdListing || !category || !selectedBoostPlan) return;
    setBoostCheckoutOutcome(null);
    startBoostCheckout({
      listingId: createdListing.id,
      category,
      duration: selectedBoostPlan.duration,
      includeInstantAlerts: selectedBoostPlan.includeInstantAlerts,
    }).then((result) => {
      setBoostCheckoutOutcome(result.outcome === "activated" || result.outcome === "paid" ? "succeeded" : "failed");
    });
  }

  useClickOutside(areaFieldRef, () => setShowAreaSuggestions(false));

  function selectCategory(next: ListingCategory) {
    setCategory(next);
    setAttributes(defaultAttributesFor(next));
    // Pre-filled default for the Preview-step selector (15-day boost + Instant Alerts) — set once,
    // here, rather than in a useEffect keyed on `category`, since that can't tell "never chosen
    // yet" apart from "explicitly skipped" (BoostPlanSelector's own Skip sets this back to null).
    setSelectedBoostPlan({ duration: 15, includeInstantAlerts: true });
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
      if (file.size > MAX_PHOTO_BYTES) {
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

  /** No separate "cover" field to set here — unlike EditListingPhotos's server-side
   * `setOwnCoverPhotoAction` (for a listing that already exists), nothing is persisted yet, so
   * "make this the cover" is just moving it to index 0 of the local array. `photoNo = i + 1` at
   * submit time (see onSubmit below) comes straight from that array order, and the review
   * step's `ListingPreviewCard` already reads `photos[0]` — so this one reorder is all either
   * needs. */
  function onSetCoverPhoto(index: number) {
    setPhotos((prev) => {
      if (index === 0) return prev;
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      next.unshift(chosen);
      return next;
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

  // 0 is a real, submittable price ("Contact for price") for pg/coworking — see
  // PRICE_ON_REQUEST_CATEGORIES's own doc comment. Every other category still needs a real one.
  const priceOnRequestAllowed = !!category && PRICE_ON_REQUEST_CATEGORIES.has(category);
  const priceValid = Number(price) > 0 || priceOnRequestAllowed;
  const detailsValid =
    priceValid &&
    title.length > 0 &&
    areaQuery.trim().length > 0 &&
    !!cityId &&
    photos.length > 0 &&
    requiredAttributesFilled;

  /**
   * Publish — and the one place this form needs an account.
   *
   * The login used to be a wall on arrival: a modal over an empty page, before the visitor had
   * seen that the form is short and free. Nothing here touches the server until this function
   * runs — photos are File objects held in memory and uploaded below — so there was never a
   * technical reason to ask first, only a habit of asking.
   *
   * `onSuccess` resumes this same call rather than returning the user to a form with a button to
   * press again, which would read as the first press having failed. It is safe because Google
   * sign-in no longer reloads the page (see AuthGateProvider.handleGoogle); before that, this
   * function's own closure — photos included — would not have survived the round trip.
   */
  async function onSubmit() {
    if (!category || !transactionType) return;

    setPending(true);
    setError(null);

    // `loggedIn`/`token` are both server-rendered (the latter seeded from an `accessToken`
    // prop) — neither one updates just because a client-side login happened.
    // AuthGateProvider.onLoginSuccess deliberately runs its `resume()` callback (this function,
    // on a resumed call) *before* router.refresh(), so a check gated on those two alone would
    // always see their pre-login values and loop straight back into requireLogin() without ever
    // reaching this fallback — always ask the server directly instead, which by the time this
    // runs (after the login's own server action already set the session) reliably has the
    // answer. A no-op on the ordinary already-logged-in path, where the token was
    // server-rendered into this component and this whole block just re-confirms it.
    let activeToken = token;
    if (!activeToken) {
      activeToken = await getAccessTokenAction();
      setToken(activeToken);
    }
    if (!activeToken) {
      setPending(false);
      pushDataLayerEvent("post_login_required", { step });
      requireLogin({ onSuccess: () => void onSubmit() });
      return;
    }

    const uploadedPhotos: { photoNo: number; hash: string; ext: string }[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photoNo = i + 1;
      const formData = new FormData();
      formData.set("file", photos[i].file);
      formData.set("listingId", listingId);
      formData.set("photoNo", String(photoNo));
      const uploadResult = await uploadPhotoAction(formData);
      if (uploadResult.error || !uploadResult.hash || !uploadResult.ext) {
        setPending(false);
        // A session can lapse between onSubmit's own upfront check and this request (a slow
        // upload in between, a token that expired in the interim) — reopen the login dialog
        // rather than leaving the advertiser looking at a plain error for something a login
        // fixes. onSuccess resumes the whole submit, same as the upfront check's own requireLogin.
        if (uploadResult.error === NEEDS_LOGIN_ERROR) {
          requireLogin({ onSuccess: () => void onSubmit() });
        } else {
          setError(uploadResult.error ?? "Failed to upload a photo");
        }
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
          await uploadVideoDirect(video.file, listingId, activeToken),
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
      description: description.trim() || undefined,
      photos: uploadedPhotos,
      videos: uploadedVideos.length > 0 ? uploadedVideos : undefined,
      attributes,
      lat: pin?.lat,
      lng: pin?.lng,
    });

    setPending(false);
    if (!result.success) {
      if (result.error === NEEDS_LOGIN_ERROR) {
        requireLogin({ onSuccess: () => void onSubmit() });
        return;
      }
      setSlotCap(result.slotCap ?? null);
      setError(result.error ?? "Failed to create listing");
      return;
    }
    setSlotCap(null);
    // `user_data` (raw email / E.164 phone) rides along for Google Ads Enhanced Conversions —
    // GTM hashes it client-side. Best-effort: a failed lookup just omits it. The poster is
    // always logged in by this point, so at least one identifier is normally present.
    const contact = await getUserContactAction();
    const phoneE164 = toE164IN(contact.phone);
    // Fired here (not on the listing page) so it's guaranteed to happen exactly once, even if
    // the user boosts, skips, or closes the tab without ever navigating to their new listing.
    pushDataLayerEvent("post_ad_success", {
      listingId: result.listing.id,
      user_data: {
        ...(contact.email ? { email: contact.email } : {}),
        ...(phoneE164 ? { phone_number: phoneE164 } : {}),
      },
    });
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
                      : "Preview Ad"}
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
                    {isIconName(c.iconName) && (
                      <span className="text-lg shrink-0 text-green">
                        <Icon name={c.iconName} />
                      </span>
                    )}
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
          <div className="flex flex-wrap gap-2.5">
            {POSTABLE_TRANSACTION_TYPES[category].map((t) => (
              <button
                key={t}
                onClick={() => selectTransactionType(t)}
                className={transactionButtonClass(transactionType === t)}
              >
                {TRANSACTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep("category")}
            // self-start: this button is a direct child of the flex-col above (unlike the
            // details/review steps' Back buttons, which sit inside their own flex row next to
            // another button) — without it, the column's default align-items: stretch stretches
            // the button to the full row width, and a <button>'s centered default text alignment
            // then makes "← Back" appear floating in the middle instead of at the left edge.
            className={`${secondaryButtonClass} self-start mt-1`}
          >
            ← Back
          </button>
        </div>
      )}

      {step === "details" && category && transactionType && (
        <div className="flex flex-col gap-4">
          <div>
            <RequiredLabel text="Title" />
            {/* Counter sits beside the input rather than sharing the label's row — reads as
              * attached to the text box it's counting, not as a second label. Counts up rather
              * than down, so it reads as progress rather than a warning, and turns amber near
              * the cap instead of only at it — a poster who has run out of room mid-sentence
              * wants to know a few characters earlier. */}
            <div className="flex items-center gap-2 max-w-[720px]">
              <input
                required
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

          <div className="flex gap-3 max-w-[720px]">
            <div className="flex-1">
              <RequiredLabel text="City" />
              <SelectField required value={cityId} onChange={(e) => onCityChange(e.target.value)}>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div ref={areaFieldRef} className="relative flex-1">
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
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe the place in your own words — the layout, what the neighbourhood is like, what's nearby, why someone would want to live here."
              className={`${fieldClass} resize-y min-h-[120px] max-w-[720px]`}
            />
            <p className="text-xs text-muted mt-1">
              Optional, but ads with a description get more responses.
            </p>
          </div>

          {/* No "specs" box. The card's chips are derived from the category fields below, which
            * the seller is already filling in — asking again produced "3bhk", "3 BHK" and
            * "3 Beds" as three spellings of the same number. See deriveCardSpecs. */}

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
                        // Native constraints have to agree with `priceValid` above, or a browser
                        // that enforces them (native form submission) blocks a legitimate
                        // "Contact for price" pg/coworking post that the JS state already allows.
                        required={!priceOnRequestAllowed}
                        min={priceOnRequestAllowed ? 0 : 1}
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
                icon="camera"
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
                    {/* Top-left, same placement/style EditListingPhotos uses for the same job
                      * post-creation — index 0 is the cover by construction (see
                      * onSetCoverPhoto), no separate field to check. */}
                    {i === 0 ? (
                      <span className="absolute top-1 left-1 bg-green text-on-green text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetCoverPhoto(i)}
                        title="Make this the cover photo"
                        className="absolute top-1 left-1 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border-0 cursor-pointer"
                      >
                        ☆ Cover
                      </button>
                    )}
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
                icon="video"
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
              Preview Ad
            </button>
          </div>
        </div>
      )}

      {step === "review" && category && transactionType && (
        // max-w matches ListingPreviewCard's own cap when there's nothing beside it: the wizard's
        // other steps fill this container's full ~1200px desktop width, but the card below is
        // only ever 340px wide — without this, the Back/Post ad row (and the text between them)
        // stretched to that full width too, leaving "Post ad" floating in empty space far to the
        // right of the card instead of sitting at its right edge. Widened, and laid out as a row,
        // only once there's a second thing (the boost selector) to sit beside the card — see
        // docs/plans/boost-instant-alerts-preview-selector.md.
        <div className={`mx-auto ${previewBoostDisplay?.showSelectorOnPreview ? "max-w-[680px]" : "max-w-[340px]"}`}>
          <div
            className={
              previewBoostDisplay?.showSelectorOnPreview
                ? "flex flex-col sm:flex-row gap-5 sm:items-start"
                : "flex flex-col gap-3"
            }
          >
            {/* What the actual browse-grid card will look like once this is posted — same
              * photo/badge/price/title/location/specs a buyer sees, not a plain text summary, so a
              * mistake (wrong photo order, a price that reads oddly, a spec that didn't come
              * through) is obvious here rather than after the ad is already live. */}
            <div className="w-full sm:max-w-[340px] sm:shrink-0">
              <ListingPreviewCard
                photoUrl={photos[0].previewUrl}
                category={category}
                transactionType={transactionType}
                title={title}
                price={price}
                priceQualifier={priceQualifier}
                areaName={areaQuery}
                cityName={cities.find((c) => c.id === cityId)?.name ?? ""}
                attributes={attributes}
              />
            </div>

            {previewBoostDisplay?.showSelectorOnPreview && (
              <div className="w-full sm:flex-1">
                <BoostPlanSelector pricing={previewBoostDisplay} value={selectedBoostPlan} onChange={setSelectedBoostPlan} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-3">
          {slotCap ? (
            <ListingSlotCapPrompt slotCap={slotCap} />
          ) : error ? (
            <p className="text-[#b3413a] text-[13px]">{error}</p>
          ) : null}

          <p className="m-0 text-[12px] text-muted">
            Your phone/email may be shown to users who unlock this listing&rsquo;s contact details.
          </p>

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
        </div>
      )}

      {step === "success" && createdListing && (
        <div className="w-full max-w-[440px] mx-auto flex flex-col items-center gap-5 py-4 px-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="w-14 h-14 rounded-full bg-green/10 text-green text-2xl flex items-center justify-center">
              <Icon name="celebrate" />
            </span>
            <div>
              <div className="font-lora text-xl sm:text-2xl font-bold text-text">Your ad is live!</div>
              <p className="text-sm text-muted mt-1 mb-0">It&apos;s now visible to buyers searching your area.</p>
            </div>
          </div>

          {previewBoostDisplay?.showSelectorOnPreview ? (
            // The full picker stays hidden here — the choice was already made on the review step
            // (BoostBundlePicker's own showSelectorOnPreview self-gate covers this too,
            // redundantly safe). Only a narrow retry surfaces, and only while an actual attempt is
            // in-flight/failed — a skipped or already-succeeded plan renders nothing, per
            // docs/plans/boost-instant-alerts-preview-selector.md's mutual-exclusivity rule.
            selectedBoostPlan && (boostCheckoutInFlight || boostCheckoutOutcome === "failed") && (
              <div className="w-full rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-4 sm:p-5">
                {boostCheckoutInFlight ? (
                  <p className="text-sm font-bold text-green m-0">Finishing your boost purchase…</p>
                ) : (
                  <>
                    <p className="text-[13px] text-text-soft mt-0 mb-3">
                      Payment for your {selectedBoostPlan.duration}-day Boost
                      {selectedBoostPlan.includeInstantAlerts ? " + Instant Alerts" : ""} didn&rsquo;t go through.
                    </p>
                    <button onClick={retryBoostCheckout} className={primaryButtonClass}>
                      Finish boosting this listing
                    </button>
                  </>
                )}
              </div>
            )
          ) : (
            /* Boost + Instant Alerts — one combined picker instead of two separate cards, each of
             * which used to only reveal its price after being clicked. Prices for every
             * combination (including the current promo code and the Agent Pro free-credit case)
             * are fetched up front; adding Instant Alerts checks out as a single payment via
             * createBoostOrder's `includeInstantAlerts`, not two payments back to back. */
            <BoostBundlePicker listingId={createdListing.id} category={createdListing.category} />
          )}

          <div className="w-full flex justify-center">
            <VideoManager listing={createdListing} accessToken={token ?? ""} />
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={buildListingPath(createdListing)}
              className="text-[13px] font-bold text-muted hover:text-text transition-colors"
            >
              View my ad &rarr;
            </Link>
            {/* Every category funnels here — not gated on `category`, since the whole point is
              * catching "this category is missing an attribute" feedback regardless of which
              * one was just posted. Pre-selects the posting_feedback topic and this listing's
              * link so a submission needs nothing more than the actual feedback text. */}
            <Link
              href={`/contact?topic=posting_feedback&listingUrl=${encodeURIComponent(`${SITE_URL}${buildListingPath(createdListing)}`)}`}
              className="text-[13px] font-bold text-muted hover:text-text transition-colors"
            >
              Feedback on posting &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
