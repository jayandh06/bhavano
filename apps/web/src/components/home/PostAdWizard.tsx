"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  Area,
  BoostPlanSelection,
  City,
  CreateListingInput,
  ListingCategory,
  ListingDetailDto,
  ReverseGeocodeResultDto,
  SellerType,
  TransactionType,
} from "@bhavano/types";
import { buildDisplayBoostPricing, defaultBoostDuration, offeredBoostDurations } from "@bhavano/types/boostPricing";
import type { BoostPriceSettings } from "@bhavano/types/boostPricing";
import { boostRecoveryMessage } from "@bhavano/types/boostEffectiveness";
import type { BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import {
  brokerageFeeIssue,
  brokerageFeeNote,
  CATEGORY_FIELD_CONFIG,
  defaultAttributesFor,
  listingAttributesIssue,
  pruneHiddenAttributes,
} from "@bhavano/types/categoryFields";
import { fromBrokerDefault, hasFromBrokerField, sellerTypeFromBroker } from "@bhavano/types/sellerType";
import { areaUnitShortLabel, formatArea, type AreaUnit } from "@bhavano/types/areaUnit";
import {
  AREA_NAME_MAX_LENGTH,
  clampPrice,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  maxPriceFor,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from "@bhavano/types/listingLimits";
import { listingPriceIssue } from "@bhavano/types/priceBounds";
import { POST_CATEGORIES, POST_CATEGORY_GROUPS } from "@bhavano/types/postCategories";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import type { VideoEntitlement } from "@bhavano/types/videoLimits";
import { MAX_VIDEO_BYTES } from "@bhavano/types/videoLimits";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, MIN_PHOTOS } from "@bhavano/types/photoLimits";
import { getAccessTokenAction } from "@/app/actions/auth";
import { getUserContactAction } from "@/app/actions/users";
import { reportClientErrorAction } from "@/app/actions/clientErrors";
import {
  createAssistedListingAction,
  createListingAction,
  fetchMyListingAction,
  uploadPhotoAction,
} from "@/app/actions/listings";
import {
  AssistedClaimLinkPanel,
  AssistedSellerPanel,
  EMPTY_ASSISTED_SELLER,
  assistedSellerProblem,
  type AssistedSeller,
} from "./AssistedSellerPanel";
import { listingPublishRequiresCheckout } from "@bhavano/types/listingPublishPricing";
import { platformFeeApplies } from "@bhavano/types/platformFeePricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { startListingPublishCheckout } from "@/lib/listingPublishCheckout";
import { NEEDS_LOGIN_ERROR, PHONE_VERIFICATION_REQUIRED_MESSAGE } from "@/lib/postAdErrors";
import {
  fetchPostAdPlanPricingAction,
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
  outlineButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/formStyles";
import { uploadVideoDirect } from "@/lib/videoUpload";
import { runWithConcurrency } from "@bhavano/types/concurrencyPool";
import {
  PHOTO_SIZE_LABEL,
  VIDEO_SIZE_LABEL,
  photoTooLargeMessage,
  videoTooLargeMessage,
} from "@/lib/uploadLimits";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import {
  clearPostAdDraft,
  draftBelongsToThisTab,
  inMemoryCopy,
  loadPostAdDraft,
  releaseDraftFromThisTab,
  savePostAdDraftFields,
  savePostAdDraftPhotos,
} from "@/lib/postAdDraft";
import { BoostBundlePicker } from "./BoostBundlePicker";
import { BoostPlanSelector } from "./BoostPlanSelector";
import { BoostRecoveryDialog } from "./BoostRecoveryDialog";
import { ListingPreviewCard } from "./ListingPreviewCard";
import { OwnerWhatsAppShare } from "./OwnerWhatsAppShare";
import { PerUnitTotalHint, PriceWordsHint } from "./PriceWithWords";
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

type SavedDraft = NonNullable<Awaited<ReturnType<typeof loadPostAdDraft>>>;

/** "saved today" / "saved yesterday" / "saved 3 days ago" (drafts expire after 7 days). */
function draftAgeLabel(savedAt: number): string {
  const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0);
  const days = Math.round((startOfDay(Date.now()) - startOfDay(savedAt)) / 86_400_000);
  return days <= 0 ? "saved today" : days === 1 ? "saved yesterday" : `saved ${days} days ago`;
}

/** The Post/Save button's status text while `pending` — see docs/plans/posting-speed-and-progress.md.
 * Falls back to the old plain "Posting…" before the first upload progress update lands (the brief
 * window spent validating the phone/session) and once everything's uploaded and the listing is
 * actually being created. */
function postAdButtonProgressText(
  progress: { phase: "photos" | "video" | "creating"; current: number; total: number; fraction?: number } | null,
): string {
  if (!progress) return "Posting…";
  if (progress.phase === "photos") return `Uploading photo ${progress.current} of ${progress.total}…`;
  if (progress.phase === "video") {
    const pct = progress.fraction !== undefined ? ` ${Math.round(progress.fraction * 100)}%` : "";
    return progress.total > 1 ? `Uploading video ${progress.current} of ${progress.total}…${pct}` : `Uploading video…${pct}`;
  }
  return "Creating listing…";
}

/** Records a failure at the Preview/Publish step — as a `post_error` dataLayer event and as a
 * `/post/error?...` trail entry in admin's Page visits, so "reached the preview, never posted" can
 * be told apart from "hit an error on Publish". Until now only success was recorded, and an error
 * left no trace anywhere a person could look. The reason travels in the path's query string
 * (PageView stores nothing but a path) and is truncated; it's the same text the seller was shown,
 * never form contents. Also reported to Loki as a `client_error` (see below). */
function reportPostError(stage: string, message: string) {
  const reason = message.slice(0, 140);
  pushDataLayerEvent("post_error", { stage, message: reason });
  // Also to Loki (Grafana: {service="bff", app="web"} | json | message=~"post_error.*") through the
  // same path a UI crash takes. A handled error like this one never reaches error.tsx, so without
  // this it was visible only in the admin trail. Prefixed so it filters apart from real crashes.
  void reportClientErrorAction({
    message: `post_error [${stage}]: ${reason}`,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  }).catch(() => {
    // Best-effort — a failed error report must never surface as a second error.
  });
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/post/error?stage=${encodeURIComponent(stage)}&reason=${encodeURIComponent(reason)}` }),
    keepalive: true,
  }).catch(() => {
    // Best-effort, same as StepTracker's own write.
  });
}

/** Same synthetic-pageview trick as reportPostError, for the boost recovery dialog
 * (docs/plans/boost-recovery-dialog.md) — GTM/GA4 sees these via pushDataLayerEvent at each call
 * site, but that's a separate system from the admin's own Page visits trail, which only reads
 * PageView rows. Decoded by the admin app's trailEntry() into readable text. */
function reportBoostRecoveryEvent(event: "shown" | "accepted" | "dismissed", trigger?: "idle" | "submit") {
  const query = trigger ? `event=${event}&trigger=${trigger}` : `event=${event}`;
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/post/boost-recovery?${query}` }),
    keepalive: true,
  }).catch(() => {
    // Best-effort, same as reportPostError's own write.
  });
}

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
 *
 * Preview is an in-wizard step (URL stays `/post`), so SoftNavPageViews / middleware never see
 * it. When it opens, also write a synthetic PageView at `/post/preview` so admin Page visits
 * shows who reached card preview — same hop SoftNav uses, same 2s same-path dedupe.
 *
 * `/post/success` is NOT written from here — createListingAction passes this session's id to
 * the BFF, which records it itself once the listing actually goes live. A fire-and-forget client
 * request after the fact silently dropped on a network blip / blocker / backgrounding, which is
 * exactly what a "did the post actually finish" signal cannot afford to miss.
 */
function StepTracker({ step }: { step: Step }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    pushDataLayerEvent("post_step_view", { step });

    if (step !== "review") return;
    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/post/preview" }),
      keepalive: true,
    }).catch(() => {
      // Offline or navigated away mid-flight — same stance as SoftNavPageViews.
    });
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
  presetCategory,
  presetTransactionType,
  sellerType: profileSellerType,
  isAdmin = false,
}: {
  cities: City[];
  defaultCityId?: string;
  /** Undefined for a logged-out visitor, who now gets the whole form — see `onSubmit`. */
  accessToken?: string;
  loggedIn: boolean;
  videoEntitlement: VideoEntitlement;
  /** From `/post?category=&transactionType=` (the homepage's AdLandingCard). Applied only when
   * there is no saved draft to resume — an unfinished ad the seller already typed wins. */
  presetCategory?: ListingCategory;
  presetTransactionType?: TransactionType;
  /** The profile's answer to "Owner or agent?". Null (never answered, or logged out) asks it on
   * the review step; once answered it's changed from the profile, not here. */
  sellerType: SellerType | null;
  /** Offers "Posting for someone else" — see AssistedSellerPanel. */
  isAdmin?: boolean;
}) {
  const { requireLogin, requireVerifiedPhone } = useAuthGate();
  const [listingId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("category");
  const [postedAs, setPostedAs] = useState<SellerType | null>(null);
  const [sellerTypeMissing, setSellerTypeMissing] = useState(false);
  const sellerTypeRef = useRef<HTMLDivElement | null>(null);
  const photoSectionRef = useRef<HTMLDivElement | null>(null);
  const [assistedSeller, setAssistedSeller] = useState<AssistedSeller>(EMPTY_ASSISTED_SELLER);
  const assistedMode = isAdmin && assistedSeller.enabled;
  // Held in state as well as taken as a prop: after a login at submit, the prop is still the
  // undefined this mounted with until router.refresh() lands, which is later than the resumed
  // upload needs it. Whichever arrives first wins.
  const [token, setToken] = useState<string | undefined>(accessToken);
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] =
    useState<TransactionType | null>(null);

  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  // "Whole price vs price per unit" — only offered for a sell/lease listing whose category has
  // an area field (see CATEGORY_FIELD_CONFIG), and always expressed in whatever unit that area
  // field is currently set to (never a separately-chosen one) — see
  // docs/plans/plot-commercial-area-units-and-price-per-unit.md.
  const [priceMode, setPriceMode] = useState<"total" | "perUnit">("total");
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
  // Where the category has a "Posted by" field, that field is the question (required below in
  // detailsIssue, pre-selected from the profile by fromBrokerDefault). The separate question is
  // only for categories without one, and only while the profile has no answer.
  const categoryHasPostedBy = !!category && hasFromBrokerField(category);
  const askSellerType = profileSellerType === null && !categoryHasPostedBy && !assistedMode;
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [preparingVideos, setPreparingVideos] = useState(false);
  // Picked files are only added once checked (and photos resized), so Preview waits for them —
  // otherwise a Publish could go out without the media the seller just chose.
  const preparingMedia = preparingPhotos || preparingVideos;
  const [videos, setVideos] = useState<SelectedVideo[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  // Messages about the photos just picked (too many, wrong format, too big). Deliberately NOT the
  // wizard's shared `error`: that one is also what the Preview screen prints above the Post button,
  // so a photo-limit note left there read as a problem with the ad being posted, and nothing
  // cleared it after the seller removed photos to get back under the limit. This one is shown only
  // beside the photo picker, and cleared by anything that changes the photos.
  const [photoNotice, setPhotoNotice] = useState<{ kind: "limit" | "file"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  // Drives the submit button's status text during the upload sequence — see
  // docs/plans/posting-speed-and-progress.md. `fraction` is only ever set for the video phase
  // (byte-level progress needs the direct-XHR path video already uses; photos only report which
  // one is in flight, not bytes — see that plan for why).
  const [uploadProgress, setUploadProgress] = useState<{
    phase: "photos" | "video" | "creating";
    current: number;
    total: number;
    fraction?: number;
  } | null>(null);
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
    platformFee: PlatformFeeSettings;
    activeDiscountPercent: number | null;
    boostEffectiveness: BoostEffectivenessDto | null;
  } | null>(null);
  const [publishCheckoutError, setPublishCheckoutError] = useState<string | null>(null);
  // Every error the wizard shows at the review/publish step is also reported (see
  // reportPostError). Keyed on the message itself so a retry that fails the same way still
  // reports once per new failure, not once per render.
  useEffect(() => {
    if (error) reportPostError(step === "review" ? "publish" : step, error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  useEffect(() => {
    if (publishCheckoutError) reportPostError("checkout", publishCheckoutError);
  }, [publishCheckoutError]);
  // A boost/instant-alerts choice made ahead of time on the review step — null means the
  // advertiser explicitly skipped it (see selectCategory's pre-fill and BoostPlanSelector's own
  // "Skip" affordance). Only ever read/acted on when previewBoostDisplay?.showSelectorOnPreview.
  const [selectedBoostPlan, setSelectedBoostPlan] = useState<BoostPlanSelection | null>(null);
  // See docs/plans/boost-recovery-dialog.md — state declared here, the idle timer that uses it is
  // below, after showBoostOnReview exists.
  const [showBoostRecovery, setShowBoostRecovery] = useState(false);
  const boostRecoveryShownRef = useRef(false);
  // null until a checkout attempt (auto-fired right after posting, or a manual retry) resolves —
  // drives the narrow "Finish boosting this listing" retry prompt on the success step.
  const [boostCheckoutOutcome, setBoostCheckoutOutcome] = useState<"succeeded" | "failed" | null>(null);
  const boostAutoFiredRef = useRef(false);
  // Draft autosave (lib/postAdDraft.ts): nothing is saved until the restore attempt has run, so
  // an empty first render can't overwrite a saved draft; and nothing after the listing exists.
  const draftSavingRef = useRef(false);
  const userStartedRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // A draft from an earlier visit waits here, on the category step, until the seller chooses to
  // continue it or start a new ad. Resuming it unasked dropped people mid-form in an ad they
  // didn't recognise as the one they'd abandoned.
  const [offeredDraft, setOfferedDraft] = useState<SavedDraft | null>(null);
  // Read once, before anything this mount saves re-marks the tab.
  const [draftFromThisTab] = useState(() => typeof window !== "undefined" && draftBelongsToThisTab());
  const presetRef = useRef({ category: presetCategory, transactionType: presetTransactionType, sellerType: profileSellerType });

  /** Same state selectCategory/selectTransactionType would leave behind; an invalid pair (lease on
   * a plot) falls back to asking, as a hand-picked category would. */
  function applyPreset() {
    const preset = presetRef.current;
    if (!preset.category) return;
    const presetCategory = preset.category;
    const postable = POSTABLE_TRANSACTION_TYPES[presetCategory];
    const presetType =
      preset.transactionType && postable.includes(preset.transactionType)
        ? preset.transactionType
        : postable.length === 1
          ? postable[0]
          : null;
    setCategory(presetCategory);
    setAttributes({ ...defaultAttributesFor(presetCategory), ...fromBrokerDefault(presetCategory, preset.sellerType) });
    setSelectedBoostPlan({ duration: 15, includeInstantAlerts: true });
    setTransactionType(presetType);
    setPriceQualifier(presetType ? (getPriceQualifierOptions(presetCategory, presetType)[0]?.value ?? "") : "");
    setStep(presetType ? "details" : "transactionType");
  }

  function applyDraft(saved: SavedDraft) {
    const { draft } = saved;
    const savedCity = draft.city;
    if (savedCity) {
      setCities((prev) => (prev.some((c) => c.id === savedCity.id) ? prev : [...prev, savedCity]));
    }
    setCategory(draft.category);
    setTransactionType(draft.transactionType);
    setPrice(draft.price);
    setPriceQualifier(draft.priceQualifier);
    setPriceMode(draft.priceMode);
    setTitle(draft.title);
    if (draft.cityId) setCityId(draft.cityId);
    setAreaQuery(draft.areaQuery);
    setAreaId(draft.areaId);
    setPin(draft.pin);
    setDescription(draft.description);
    setAttributes(draft.attributes);
    setSelectedBoostPlan(draft.selectedBoostPlan);
    setPhotos(saved.photos.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })));
    if (saved.droppedPhotos > 0) {
      setPhotoNotice({
        kind: "file",
        text:
          saved.droppedPhotos === 1
            ? "1 photo from your saved ad couldn't be restored. Please add it again."
            : `${saved.droppedPhotos} photos from your saved ad couldn't be restored. Please add them again.`,
      });
    }
    // The preview is only shown after the account check in onPreview, so resume one step back.
    setStep(draft.step === "review" ? "details" : draft.step);
  }

  useEffect(() => {
    let cancelled = false;
    void loadPostAdDraft().then((saved) => {
      if (cancelled) return;
      if (!userStartedRef.current) {
        if (!saved) {
          applyPreset();
        } else if (draftFromThisTab) {
          applyDraft(saved);
          setDraftRestored(true);
        } else {
          setOfferedDraft(saved);
        }
      }
      draftSavingRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount; the helpers only call state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving /post in-app (no reload) makes a return to it a new visit, which offers the draft.
  useEffect(() => () => releaseDraftFromThisTab(), []);

  function continueOfferedDraft() {
    if (!offeredDraft) return;
    userStartedRef.current = true;
    applyDraft(offeredDraft);
    setOfferedDraft(null);
  }

  /** Only one draft is kept per device, and the new ad's autosave would replace it anyway —
   * cleared now so its photos can't come back attached to the new ad after a reload. */
  function discardOfferedDraft() {
    if (!offeredDraft) return;
    setOfferedDraft(null);
    void clearPostAdDraft();
  }

  function startNewInsteadOfDraft() {
    discardOfferedDraft();
    applyPreset();
  }

  // Off while posting for someone else: one seller's ad must never come back as the admin's own
  // next post.
  useEffect(() => {
    if (!draftSavingRef.current || !category || step === "success" || assistedMode) return;
    const timer = setTimeout(() => {
      if (!draftSavingRef.current) return;
      savePostAdDraftFields({
        step,
        category,
        transactionType,
        price,
        priceQualifier,
        priceMode,
        title,
        cityId,
        city: cities.find((c) => c.id === cityId) ?? null,
        areaQuery,
        areaId,
        pin,
        description,
        attributes,
        selectedBoostPlan,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    step,
    category,
    transactionType,
    price,
    priceQualifier,
    priceMode,
    title,
    cityId,
    cities,
    areaQuery,
    areaId,
    pin,
    description,
    attributes,
    selectedBoostPlan,
    assistedMode,
  ]);

  useEffect(() => {
    if (!draftSavingRef.current || assistedMode) return;
    void savePostAdDraftPhotos(photos.map((photo) => photo.file));
  }, [photos, assistedMode]);

  function startOver() {
    void clearPostAdDraft();
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setCategory(null);
    setTransactionType(null);
    setPrice("");
    setPriceQualifier("");
    setPriceMode("total");
    setTitle("");
    setCityId(defaultCityId ?? initialCities[0]?.id ?? "");
    setAreaQuery("");
    setAreaId(null);
    setPin(null);
    setDescription("");
    setAttributes({});
    setSelectedBoostPlan(null);
    setPinLookupNote(null);
    setError(null);
    setPhotoNotice(null);
    setDraftRestored(false);
    setStep("category");
  }

  /**
   * The phone's Back button on the preview returns to the form instead of leaving `/post`.
   *
   * The steps are component state, not URLs, so without a history entry of its own the preview's
   * "previous page" is whatever came before `/post` — for an ad visitor, the home page. On
   * 29 Sept a seller who had filled in the whole form and signed in pressed Back on the preview and
   * landed on `/` with nothing posted; 9 of ~100 web preview views had gone the same way.
   *
   * Only the preview gets an entry. Earlier steps have their own resets on the in-page Back buttons
   * (category, transaction type), which a popstate would have to duplicate. Next.js' patched
   * pushState copies its router state into the entry, so popping back to `/post` restores the same
   * tree without a remount or reload.
   */
  const reviewHistoryEntryRef = useRef(false);
  const stepRef = useRef(step);
  const pendingRef = useRef(pending);
  useEffect(() => {
    stepRef.current = step;
    pendingRef.current = pending;
  }, [step, pending]);

  useEffect(() => {
    if (step !== "review" || reviewHistoryEntryRef.current) return;
    window.history.pushState({ postAdReview: true }, "");
    reviewHistoryEntryRef.current = true;
  }, [step]);

  useEffect(() => {
    // A reload on the preview keeps its history entry but resumes on the details step, so
    // re-adopt the entry rather than leave a Back press that does nothing.
    if (window.history.state?.postAdReview) reviewHistoryEntryRef.current = true;
    function onPopState(event: PopStateEvent) {
      if (!reviewHistoryEntryRef.current || event.state?.postAdReview) return;
      reviewHistoryEntryRef.current = false;
      if (stepRef.current !== "review") {
        // Left the preview without popping it (posted, or started over): this entry now only
        // duplicates `/post`, so continue to where Back would have gone without it.
        window.history.back();
      } else if (pendingRef.current) {
        // Mid-upload: stay on the preview, where the progress and any error are shown.
        window.history.pushState({ postAdReview: true }, "");
        reviewHistoryEntryRef.current = true;
      } else {
        setStep("details");
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function backToDetails() {
    setError(null);
    setSellerTypeMissing(false);
    if (reviewHistoryEntryRef.current && window.history.state?.postAdReview) {
      window.history.back();
    } else {
      setStep("details");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchPostAdPlanPricingAction()
      .then((settings) => {
        if (!cancelled) setPlanPricingSettings(settings);
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
            planPricingSettings.activeDiscountPercent,
          )
        : null,
    [category, planPricingSettings],
  );

  const showPublishPanelOnReview = !assistedMode && !!(
    category &&
    planPricingSettings &&
    (platformFeeApplies(category, planPricingSettings.platformFee) || previewBoostDisplay?.showSelectorOnPreview)
  );

  const showBoostOnReview =
    !!previewBoostDisplay?.showSelectorOnPreview ||
    !!(category && planPricingSettings && platformFeeApplies(category, planPricingSettings.platformFee));

  // selectedBoostPlan carries its 15-day default (set in selectCategory) even while the preview
  // selector itself is hidden (admin's showSelectorOnPreview off) — purely so the selector shows
  // a sensible pre-filled choice the moment it *is* shown. Used raw, that default would make every
  // ad require publish checkout for a boost the advertiser never saw or had any way to skip, since
  // BoostPlanSelector (and its Skip link) never even mounts in that case. Gating on
  // showSelectorOnPreview is what makes a hidden default count as "no boost chosen" everywhere a
  // real purchase decision is made from it: needsCheckout below, the checkoutIntent sent to
  // create(), and finishPublishCheckout's own boostSelection.
  const boostIntent = previewBoostDisplay?.showSelectorOnPreview ? selectedBoostPlan : null;

  // docs/plans/boost-recovery-dialog.md: at most once per wizard mount, whichever comes first of
  // (a) 60s idle on the review step with Boost still skipped, or (b) tapping Post ad while still
  // skipped (handlePostAdClick below). boostRecoveryShownRef (not state) so both checks see the
  // same answer synchronously, without a stale-closure race between the timer and a click.
  useEffect(() => {
    if (!previewBoostDisplay?.showSelectorOnPreview || step !== "review" || selectedBoostPlan !== null) return;
    if (boostRecoveryShownRef.current) return;
    const timer = window.setTimeout(() => {
      boostRecoveryShownRef.current = true;
      setShowBoostRecovery(true);
      pushDataLayerEvent("boost_recovery_shown", { trigger: "idle" });
      reportBoostRecoveryEvent("shown", "idle");
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [previewBoostDisplay?.showSelectorOnPreview, step, selectedBoostPlan]);

  function handlePostAdClick() {
    if (previewBoostDisplay?.showSelectorOnPreview && selectedBoostPlan === null && !boostRecoveryShownRef.current) {
      boostRecoveryShownRef.current = true;
      setShowBoostRecovery(true);
      pushDataLayerEvent("boost_recovery_shown", { trigger: "submit" });
      reportBoostRecoveryEvent("shown", "submit");
      return;
    }
    void onSubmit();
  }

  function handleBoostRecoveryAddBoost() {
    setShowBoostRecovery(false);
    pushDataLayerEvent("boost_recovery_accepted", {});
    reportBoostRecoveryEvent("accepted");
    const duration = previewBoostDisplay ? defaultBoostDuration(offeredBoostDurations(previewBoostDisplay)) : 15;
    setSelectedBoostPlan({ duration: duration as BoostPlanSelection["duration"], includeInstantAlerts: true });
    void onSubmit();
  }

  function handleBoostRecoverySkip() {
    setShowBoostRecovery(false);
    pushDataLayerEvent("boost_recovery_dismissed", {});
    reportBoostRecoveryEvent("dismissed");
    void onSubmit();
  }

  async function waitForListingLive(listingId: string): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
      const listing = await fetchMyListingAction(listingId);
      if (listing?.publishState === "live") return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  async function finishPublishCheckout(listing: ListingDetailDto): Promise<boolean> {
    setPublishCheckoutError(null);
    const checkout = await startListingPublishCheckout({
      listingId: listing.id,
      category: listing.category,
      boostSelection: boostIntent,
    });
    if (checkout.outcome === "cancelled") {
      setPublishCheckoutError("Payment was cancelled — your ad is not live yet.");
      return false;
    }
    if (checkout.outcome === "error") {
      setPublishCheckoutError(checkout.message);
      return false;
    }
    if (checkout.outcome === "paid") {
      const live = await waitForListingLive(listing.id);
      if (!live) {
        setPublishCheckoutError("Payment received — still confirming publish. Please retry in a moment.");
        return false;
      }
    }
    return true;
  }

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
  // Legacy post-success boost checkout only — preview-step / publish-checkout listings go live via
  // `finishPublishCheckout` in `onSubmit`, not this effect.
  useEffect(() => {
    if (boostAutoFiredRef.current) return;
    if (!createdListing || !category || !selectedBoostPlan) return;
    if (!previewBoostDisplay?.showSelectorOnPreview) return;
    if (createdListing.publishState === "pending_checkout") return;
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
    userStartedRef.current = true;
    discardOfferedDraft();
    setCategory(next);
    setAttributes({ ...defaultAttributesFor(next), ...fromBrokerDefault(next, profileSellerType) });
    // A category swap can invalidate "price per unit" (the new category might have no area field
    // at all, or a different one) — reset to the plain default rather than risk submitting a
    // priceUnit that no longer matches anything.
    setPriceMode("total");
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
    // Price-per-unit is sell/lease only — switching to rent must not carry a stale "perUnit" mode
    // forward into a combination the server would reject.
    if (next !== "sell" && next !== "lease") setPriceMode("total");
    setStep("details");
  }

  async function onPhotosSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setPhotoNotice(null);

    const room = MAX_PHOTOS - photos.length;
    const candidates = Array.from(files).slice(0, room);
    if (files.length > room) {
      setPhotoNotice({
        kind: "limit",
        text: `Up to ${MAX_PHOTOS} photos allowed — only added the first ${room}.`,
      });
    }

    setPreparingPhotos(true);
    const accepted: SelectedPhoto[] = [];
    for (const picked of candidates) {
      if (!ALLOWED_PHOTO_TYPES.includes(picked.type)) {
        setPhotoNotice({
          kind: "file",
          text: `"${picked.name}" isn't a supported format — use JPEG, PNG, WebP, or GIF.`,
        });
        continue;
      }
      // A photo small enough to skip shrinking is still the picker's File, which only points at
      // the phone's copy; that copy can vanish before Post ad (29 Sept, Delhi: "Photo 1 can no
      // longer be read" a minute after the preview). Holding the bytes from the start avoids that.
      let file: File;
      try {
        file = await inMemoryCopy(await shrinkPhoto(picked));
      } catch {
        setPhotoNotice({ kind: "file", text: `"${picked.name}" couldn't be read. Try picking it again.` });
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoNotice({ kind: "file", text: photoTooLargeMessage(picked.name) });
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setPreparingPhotos(false);
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
  }

  function onRemovePhoto(index: number) {
    // Removing a photo is the fix for "too many photos", so the note about it goes with it.
    setPhotoNotice(null);
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
    setPhotoNotice(null);
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

    setPreparingVideos(true);
    try {
      await addVideos(candidates);
    } finally {
      setPreparingVideos(false);
    }
  }

  async function addVideos(candidates: File[]) {
    for (const file of candidates) {
      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        setVideoError(`"${file.name}" isn't a supported video format.`);
        continue;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setVideoError(videoTooLargeMessage(file.name));
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
    // Same reasoning as onRemovePhoto: removing one is how a seller gets back under the limit.
    setVideoError(null);
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
   * change the City select / Area field manually after the map pre-fills them. The local place
   * is saved as an area under the resolved city. A pin never creates a city.
   *
   * Applied directly when the pin resolves to a city. A pin outside every curated catchment does
   * not create a city — the area name is filled in and the seller picks the city. See
   * docs/plans/canonical-city-catchment.md. */
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
        suggestion.resolvedLocality
          ? `This place isn't inside a city we list. Pick the city, and we'll save ${suggestion.resolvedLocality} as the area.`
          : "Couldn't confidently match a city here — please pick City and Area below.",
      );
    }

    if (suggestion.resolvedLocality) {
      setAreaId(suggestion.areaId ?? null);
      setAreaQuery(suggestion.resolvedLocality);
      setAreaSuggestions([]);
    }
  }

  // "Whole price vs price per unit" is only offered for a sell/lease listing whose category has
  // an area field — see priceMode's own comment.
  const priceUnitAreaField =
    category && (transactionType === "sell" || transactionType === "lease")
      ? CATEGORY_FIELD_CONFIG[category].find((field) => field.type === "area")
      : undefined;
  const currentAreaUnit = (attributes[`${priceUnitAreaField?.key}Unit`] as AreaUnit | undefined) ?? "sqft";
  // 0 is a real, submittable price ("Contact for price") for pg/coworking — see
  // PRICE_ON_REQUEST_CATEGORIES's own doc comment. Every other category still needs a real one.
  const priceOnRequestAllowed = !!category && PRICE_ON_REQUEST_CATEGORIES.has(category);
  // Same range check the server makes, on the total — here so it's caught before the preview and
  // before any photo upload, not after pressing Publish.
  const pricedPerUnit = priceMode === "perUnit" && !!priceUnitAreaField;
  const priceArea = priceUnitAreaField ? Number(attributes[priceUnitAreaField.key]) : NaN;
  // The listing's total (per-unit prices multiplied out), which the brokerage limits scale with.
  const totalPrice =
    price === "" || (pricedPerUnit && !(priceArea > 0))
      ? null
      : pricedPerUnit
        ? Math.round(Number(price) * priceArea)
        : Number(price);
  const brokerageNote = transactionType ? brokerageFeeNote(transactionType, totalPrice, attributes) : null;
  const priceIssue =
    category && transactionType && price !== "" && (!pricedPerUnit || priceArea > 0)
      ? listingPriceIssue(
          category,
          transactionType,
          pricedPerUnit ? Math.round(Number(price) * priceArea) : Number(price),
          pricedPerUnit ? { price: Number(price), area: priceArea, unit: currentAreaUnit } : undefined,
        )
      : null;
  // Everything the BFF would reject on Post ad, checked here instead, in form order, so the
  // seller fixes it beside the field rather than meeting it on the preview. `missing` is just
  // not filled in yet (a muted hint); anything else is a value that has to change (red).
  const detailsIssue: { text: string; missing: boolean } | null = (() => {
    if (title.trim().length === 0) return { text: "Add a title", missing: true };
    if (title.trim().length < TITLE_MIN_LENGTH)
      return { text: `Title needs at least ${TITLE_MIN_LENGTH} characters`, missing: false };
    if (!cityId) return { text: "Pick a city", missing: true };
    if (areaQuery.trim().length === 0) return { text: "Add the area / locality", missing: true };
    if (!areaId && areaQuery.trim().length > AREA_NAME_MAX_LENGTH)
      return { text: `Area / locality must be ${AREA_NAME_MAX_LENGTH} characters or fewer`, missing: false };
    if (description.trim().length === 0) return { text: "Add a description", missing: true };
    if (description.trim().length < DESCRIPTION_MIN_LENGTH)
      return { text: `Description needs at least ${DESCRIPTION_MIN_LENGTH} characters`, missing: false };
    // The assisted panel's own Owner/Agent answer overrides this field on submit. Checked before
    // the generic attribute sweep below so this field's own friendlier copy wins over the generic
    // "Posted by Broker / Agent is required" listingAttributesIssue would otherwise produce — the
    // field is marked required there too, so EditListingForm's generic check (no bespoke copy of
    // its own) enforces the same thing on an existing listing.
    if (categoryHasPostedBy && !assistedMode && !sellerTypeFromBroker(attributes.fromBroker))
      return { text: "Choose Owner or Broker / Agent under Posted by", missing: true };
    if (category && transactionType) {
      const attributeIssue = listingAttributesIssue(category, transactionType, attributes);
      if (attributeIssue) return { text: attributeIssue, missing: attributeIssue.endsWith(" is required") };
    }
    if (!(Number(price) > 0) && !priceOnRequestAllowed) return { text: "Add a price", missing: true };
    if (priceIssue) return { text: priceIssue, missing: false };
    const brokerageIssue = transactionType ? brokerageFeeIssue(transactionType, totalPrice, attributes) : null;
    if (brokerageIssue) return { text: brokerageIssue, missing: false };
    if (photos.length < MIN_PHOTOS) return { text: `Add at least ${MIN_PHOTOS} photos`, missing: true };
    if (askSellerType && !postedAs) return { text: "Choose Owner or Agent / broker", missing: true };
    const assistedProblem = assistedMode ? assistedSellerProblem(assistedSeller) : null;
    if (assistedProblem) return { text: assistedProblem, missing: false };
    return null;
  })();
  const detailsValid = !detailsIssue && !preparingMedia;

  /**
   * "Preview Ad" — where the account is first asked for.
   *
   * The login used to be a wall on arrival: a modal over an empty page, before the visitor had
   * seen that the form is short and free. It now waits until the details are filled in and the
   * visitor asks to preview, so the preview (and its boost/checkout options) is only ever shown
   * to someone who can actually publish it. `onSuccess` moves straight on to the preview rather
   * than leaving the visitor on the form to press the button again.
   *
   * Same server-side token check as onSubmit below, for the same reason: `token` is seeded from a
   * server-rendered prop and does not update just because a client-side login happened.
   */
  async function onPreview() {
    let activeToken = token;
    if (!activeToken) {
      activeToken = await getAccessTokenAction();
      setToken(activeToken);
    }
    setPhotoNotice(null);
    setError(null);
    setSellerTypeMissing(false);
    if (!activeToken) {
      pushDataLayerEvent("post_login_required", { step });
      requireLogin({ onSuccess: () => setStep("review") });
      return;
    }
    setStep("review");
  }

  /**
   * Publish. Still checks for an account itself: onPreview asked for one, but a session can lapse
   * between previewing and publishing, and a stale preview is not a reason to fail the post.
   *
   * `onSuccess` resumes this same call rather than returning the user to a form with a button to
   * press again, which would read as the first press having failed. It is safe because Google
   * sign-in no longer reloads the page (see AuthGateProvider.handleGoogle); before that, this
   * function's own closure — photos included — would not have survived the round trip.
   */
  async function onSubmit() {
    try {
      await publish();
    } catch (submitError) {
      // A server action rejects rather than returning `{ error }` when the request itself fails
      // (connection dropped, or a body Next.js can't parse). Without this the button stays on
      // "Posting…" for good.
      setPending(false);
      reportPostError("publish_exception", submitError instanceof Error ? submitError.message : String(submitError));
      setError("Your ad couldn't be sent. Check your internet connection and tap Post ad again.");
    }
  }

  async function publish() {
    if (!category || !transactionType) return;
    if (askSellerType && !postedAs) {
      backToDetails();
      setSellerTypeMissing(true);
      setTimeout(() => sellerTypeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    const assistedProblem = assistedMode ? assistedSellerProblem(assistedSeller) : null;
    if (assistedProblem) {
      setError(assistedProblem);
      return;
    }
    // Belt-and-suspenders: the Preview button on Details already blocks fewer than MIN_PHOTOS, but
    // if `photos` is ever below it by the time "Post ad" is pressed on Review, the server's own
    // re-check (ListingsService.create) would otherwise reject the request from a screen with no
    // photo-add/remove UI of its own — a dead end that only ever fails the same way again. Sending
    // the visitor back to Details with something to actually do about it, instead of a repeatable
    // server error, is what turned one real session into four identical failures over 40 minutes.
    if (photos.length < MIN_PHOTOS) {
      backToDetails();
      setPhotoNotice({
        kind: "file",
        text: `Add at least ${MIN_PHOTOS} photos before posting — only ${photos.length} ${photos.length === 1 ? "is" : "are"} ready.`,
      });
      setTimeout(() => photoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }

    setPending(true);
    setError(null);
    setUploadProgress(null);

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

    // A verified phone is required to publish (buyers reach the seller by phone; it is also the
    // spam control) but login no longer collects one, so a Google/Apple account arrives here
    // without it. Ask now, before any upload, and resume this same call once it is verified.
    // The BFF re-checks authoritatively on create — see the result handling below.
    // Not for an assisted ad: the seller proves their phone when they claim it.
    const publisher = assistedMode ? null : await getUserContactAction();
    if (publisher && !publisher.phone) {
      setPending(false);
      requireVerifiedPhone({ onSuccess: () => void onSubmit() });
      return;
    }

    // Uploaded with up to 3 in flight at once (runWithConcurrency) rather than one at a time —
    // see docs/plans/posting-speed-and-progress.md: sequential upload of every photo then every
    // video was the dominant cost in how slow posting felt, since server-side processing
    // (watermarking, variants) already runs in the background and never blocked this. 3 covers
    // MAX_PHOTOS (6) in two waves.
    //
    // Each photo's own result is captured rather than thrown, because a pool worker throwing
    // only fails *that* worker — the original behavior (abort the whole submit on the first
    // failure) has to be reconstructed after the pool settles instead. `photoFailure` also stops
    // new workers from starting real work once set, though an upload already in flight when it's
    // set will still land — exactly zero extra uploads past a failure isn't achievable once work
    // is genuinely concurrent, which is the trade this makes for the speed.
    type PhotoFailure = { kind: "unreadable" | "needsLogin" | "other"; photoNo: number; message?: string };
    let photosCompleted = 0;
    let photoFailure: PhotoFailure | null = null;
    const photoResults = await runWithConcurrency(photos, 3, async (picked, i) => {
      const photoNo = i + 1;
      if (photoFailure) return null;
      // Read up front so a photo whose file iOS has since deleted fails here, by number, instead
      // of being sent as a truncated upload.
      let file: File;
      try {
        file = await inMemoryCopy(picked.file);
      } catch {
        photoFailure ??= { kind: "unreadable", photoNo };
        return null;
      }
      const formData = new FormData();
      formData.set("file", file);
      formData.set("listingId", listingId);
      formData.set("photoNo", String(photoNo));
      const uploadResult = await uploadPhotoAction(formData);
      if (uploadResult.error || !uploadResult.hash || !uploadResult.ext) {
        photoFailure ??= {
          kind: uploadResult.error === NEEDS_LOGIN_ERROR ? "needsLogin" : "other",
          photoNo,
          message: uploadResult.error,
        };
        return null;
      }
      photosCompleted++;
      setUploadProgress({ phase: "photos", current: photosCompleted, total: photos.length });
      return { photoNo, hash: uploadResult.hash, ext: uploadResult.ext };
    });

    // Asserted, not just annotated — TS's control-flow narrowing gets confused by a `let`
    // mutated only inside the pool's async closures above (it can't see that `await
    // runWithConcurrency(...)` guarantees every worker already ran), and otherwise narrows
    // `photoFailure` to `null` here regardless of the declared type, making every `.kind`/
    // `.photoNo`/`.message` access below a false "does not exist on type 'never'" error.
    const failure = photoFailure as PhotoFailure | null;
    if (failure) {
      setPending(false);
      // A session can lapse between onSubmit's own upfront check and this request (a slow
      // upload in between, a token that expired in the interim) — reopen the login dialog
      // rather than leaving the advertiser looking at a plain error for something a login
      // fixes. onSuccess resumes the whole submit, same as the upfront check's own requireLogin.
      if (failure.kind === "needsLogin") {
        requireLogin({ onSuccess: () => void onSubmit() });
      } else if (failure.kind === "unreadable") {
        setError(`Photo ${failure.photoNo} can no longer be read. Remove it, add it again, then tap Post ad.`);
      } else {
        setError(failure.message ?? "Failed to upload a photo");
      }
      return;
    }
    const uploadedPhotos = photoResults.filter((r): r is NonNullable<typeof r> => r !== null);

    // Video never blocks the post — if a single upload fails, drop it and continue rather than
    // aborting the whole submission the way a failed photo upload does (photos are required,
    // video is additive). ListingsService.create() also re-validates and silently trims against
    // the caller's current entitlement, so this array is best-effort even before it gets there.
    // Concurrency 2, not 3 like photos — matches the BFF's own global video-upload cap
    // (MAX_CONCURRENT_VIDEO_UPLOADS in video-upload.guard-rails.ts) exactly; going higher only
    // trades client-side parallelism for more 503s from that shared limit.
    const videosToUpload = assistedMode ? [] : videos;
    let videosCompleted = 0;
    const uploadedVideoResults = await runWithConcurrency(videosToUpload, 2, async (video, i) => {
      try {
        const result = await uploadVideoDirect(video.file, listingId, activeToken, (fraction) =>
          setUploadProgress({ phase: "video", current: i + 1, total: videosToUpload.length, fraction }),
        );
        videosCompleted++;
        setUploadProgress({ phase: "video", current: videosCompleted, total: videosToUpload.length });
        return result;
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Failed to upload a video");
        return null;
      }
    });
    const uploadedVideos = uploadedVideoResults.filter((r): r is NonNullable<typeof r> => r !== null);

    const needsCheckout =
      category &&
      planPricingSettings &&
      listingPublishRequiresCheckout(category, planPricingSettings.platformFee, boostIntent);

    const listingInput: CreateListingInput = {
      id: listingId,
      category,
      transactionType,
      price: Number(price),
      priceQualifier: priceQualifier || undefined,
      priceUnit: priceMode === "perUnit" && priceUnitAreaField ? currentAreaUnit : undefined,
      title,
      areaId: areaId ?? undefined,
      areaName: areaId ? undefined : areaQuery.trim(),
      cityId,
      description: description.trim(),
      photos: uploadedPhotos,
      videos: uploadedVideos.length > 0 ? uploadedVideos : undefined,
      attributes: pruneHiddenAttributes(category, transactionType, attributes),
      lat: pin?.lat,
      lng: pin?.lng,
      postedAs: profileSellerType ? undefined : (sellerTypeFromBroker(attributes.fromBroker) ?? postedAs ?? undefined),
      ...(needsCheckout
        ? {
            checkoutIntent: boostIntent
              ? {
                  boostDays: boostIntent.duration,
                  includeInstantAlerts: boostIntent.includeInstantAlerts,
                }
              : undefined,
          }
        : {}),
    };
    setUploadProgress({ phase: "creating", current: 1, total: 1 });
    const result =
      assistedMode && assistedSeller.sellerType
        ? await createAssistedListingAction({
            ...listingInput,
            // A "Posted by Broker / Agent" answer pre-filled from the admin's own profile would
            // otherwise contradict the seller's.
            attributes:
              "fromBroker" in attributes
                ? { ...attributes, fromBroker: assistedSeller.sellerType === "agent" ? "yes" : "no" }
                : attributes,
            claimPhone: assistedSeller.phone,
            claimName: assistedSeller.name.trim(),
            postedAs: assistedSeller.sellerType,
          })
        : await createListingAction(listingInput);

    if (!result.success) {
      setPending(false);
      if (result.error === NEEDS_LOGIN_ERROR) {
        requireLogin({ onSuccess: () => void onSubmit() });
        return;
      }
      // Backstop for a phone that went missing between the check above and this request.
      if (result.error?.includes(PHONE_VERIFICATION_REQUIRED_MESSAGE)) {
        requireVerifiedPhone({ onSuccess: () => void onSubmit() });
        return;
      }
      setSlotCap(result.slotCap ?? null);
      setError(result.error ?? "Failed to create listing");
      return;
    }
    setSlotCap(null);
    setCreatedListing(result.listing);
    // The listing exists now (even if payment is still pending), so a retry must not recreate it.
    draftSavingRef.current = false;
    void clearPostAdDraft();

    // Not a conversion, and nothing to pay: the seller publishes it when they claim it.
    if (assistedMode) {
      setPending(false);
      setStep("success");
      return;
    }

    if (result.listing.publishState === "pending_checkout") {
      const published = await finishPublishCheckout(result.listing);
      setPending(false);
      if (!published) return;
    } else {
      setPending(false);
    }

    const contact = await getUserContactAction();
    const phoneE164 = toE164IN(contact.phone);
    pushDataLayerEvent("post_ad_success", {
      listingId: result.listing.id,
      user_data: {
        ...(contact.email ? { email: contact.email } : {}),
        ...(phoneE164 ? { phone_number: phoneE164 } : {}),
      },
    });
    setStep("success");
  }

  return (
    <div>
      <StepTracker step={step} />
      {draftRestored && step !== "success" && (
        // Deliberately loud: someone who tapped "Post ad" and landed mid-form, possibly in a
        // category they did not choose today, has to understand why before they publish into it.
        <div
          role="status"
          className="mb-5 rounded-xl border-2 border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-3.5 text-text"
        >
          <div className="font-lora font-bold text-[15px] mb-1">
            We restored the ad you were writing on this device
          </div>
          <p className="m-0 text-[13px] text-text-soft">
            {(() => {
              const label = POST_CATEGORIES.find((c) => c.value === category)?.label;
              return label ? `You are continuing your ${label} ad from where you left off. ` : "";
            })()}
            Check the category and details before you post, or start a new ad.
          </p>
          <button
            type="button"
            onClick={startOver}
            className="mt-2.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-bold text-text cursor-pointer"
          >
            Start a new ad instead
          </button>
        </div>
      )}
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

      {isAdmin && step !== "success" && (
        <AssistedSellerPanel value={assistedSeller} onChange={setAssistedSeller} />
      )}

      {step === "category" && (
        <div className="flex flex-col gap-6">
          {offeredDraft && (
            <div
              role="region"
              aria-label="Unfinished ad"
              className="rounded-xl border-2 border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-3.5 text-text"
            >
              <div className="font-lora font-bold text-[15px] mb-1">You have an unfinished ad on this device</div>
              <p className="m-0 text-[13px] text-text-soft">
                {[
                  POST_CATEGORIES.find((c) => c.value === offeredDraft.draft.category)?.label,
                  offeredDraft.draft.transactionType ? TRANSACTION_TYPE_LABELS[offeredDraft.draft.transactionType] : null,
                  offeredDraft.draft.title.trim() ? `“${offeredDraft.draft.title.trim()}”` : null,
                  offeredDraft.photos.length > 0
                    ? `${offeredDraft.photos.length} photo${offeredDraft.photos.length === 1 ? "" : "s"}`
                    : null,
                  draftAgeLabel(offeredDraft.savedAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={continueOfferedDraft} className={primaryButtonClass}>
                  Continue this ad
                </button>
                <button type="button" onClick={startNewInsteadOfDraft} className={outlineButtonClass}>
                  Start a new ad
                </button>
              </div>
              <p className="m-0 mt-2 text-[12px] text-muted">
                Picking a category below also starts a new ad and discards this one.
              </p>
            </div>
          )}
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

          <div className="max-w-[720px]">
            <label className={labelClass}>
              Pin your exact location (optional — helps buyers find you, and
              auto-fills City/Area below)
            </label>
            <LocationMapPicker
              defaultCenter={
                cities.find((c) => c.id === cityId) ??
                cities[0] ?? { lat: 20.5937, lng: 78.9629 }
              }
              initialPin={pin}
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
            <RequiredLabel text="Description" />
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={5}
              placeholder="Describe the place in your own words — the layout, what the neighbourhood is like, what's nearby, why someone would want to live here."
              className={`${fieldClass} resize-y min-h-[120px] max-w-[720px]`}
            />
            <p className="text-xs text-muted mt-1">
              At least {DESCRIPTION_MIN_LENGTH} characters — ads with a real description get more responses.
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
              fieldNote={brokerageNote}
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
                          // Native constraints have to agree with `priceValid` above, or a browser
                          // that enforces them (native form submission) blocks a legitimate
                          // "Contact for price" pg/coworking post that the JS state already allows.
                          required={!priceOnRequestAllowed}
                          min={priceOnRequestAllowed ? 0 : 1}
                          max={priceMode === "perUnit" ? undefined : maxPriceFor(transactionType)}
                          inputMode="numeric"
                          value={price}
                          // clampPrice's own max (maxPriceFor(transactionType), a whole-price
                          // bound) is generous enough to never actually trigger for a realistic
                          // per-unit figure — safe to reuse as-is for both modes.
                          onChange={(e) => setPrice(clampPrice(e.target.value, transactionType))}
                          className={fieldClass}
                        />
                        <PriceWordsHint
                          value={price}
                          suffix={priceMode === "perUnit" ? ` per ${areaUnitShortLabel(currentAreaUnit, 1)}` : ""}
                        />
                        {pricedPerUnit && (
                          <PerUnitTotalHint total={totalPrice} area={priceArea > 0 ? formatArea(priceArea, currentAreaUnit) : null} />
                        )}
                        {priceIssue && <p className="text-xs text-[#b3413a] mt-1.5 m-0">{priceIssue}</p>}
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
                  </div>
                ),
              }}
            />
          </div>

          <div className="max-w-[720px]" ref={photoSectionRef}>
            <RequiredLabel text={`Photos (${MIN_PHOTOS}-${MAX_PHOTOS})`} />
            {photos.length < MAX_PHOTOS && (
              // A styled label wrapping a hidden input rather than a bare <input type="file">.
              // The native control renders as a small grey "Choose files" button that is easy to
              // scroll past — on the one step where skipping it costs the listing most, since an
              // ad with no photo is the one nobody opens.
              <UploadZone
                accept="image/jpeg,image/png,image/webp,image/gif"
                onFiles={(files) => void onPhotosSelected(files)}
                icon="camera"
                label={preparingPhotos ? "Preparing photos…" : photos.length > 0 ? "Add more photos" : "Add photos"}
                hint={`JPG, PNG or WebP · up to ${PHOTO_SIZE_LABEL} each · ${MAX_PHOTOS - photos.length} more allowed`}
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
            {/* The "only added the first N" note is only true while the list is still full; the moment a
              * photo is removed it is stale, so it is hidden as well as cleared. */}
            {photoNotice && (photoNotice.kind === "file" || photos.length >= MAX_PHOTOS) && (
              <p className="text-[#b3413a] text-[13px] mt-2">{photoNotice.text}</p>
            )}
            {error && (
              <p className="text-[#b3413a] text-[13px] mt-2">{error}</p>
            )}
          </div>

          <div className="max-w-[720px]">
            <label className={labelClass}>
              Video (optional, up to {videoEntitlement.maxVideos})
            </label>
            <p className="text-xs text-muted mt-0.5 mb-1.5">
              Up to {videoEntitlement.maxDurationSec}s each.
              {videoEntitlement.canUpgradeByBoosting &&
                " Boost this listing after posting to add up to 3 videos, up to 2 minutes each."}
            </p>
            {assistedMode && (
              <p className="text-xs text-muted mt-0 mb-1.5">
                Not saved when posting for someone else. The seller can add videos after publishing.
              </p>
            )}
            {!assistedMode && videos.length < videoEntitlement.maxVideos && (
              <UploadZone
                accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska"
                onFiles={(files) => void onVideosSelected(files)}
                icon="video"
                label={preparingVideos ? "Preparing video…" : videos.length > 0 ? "Add another video" : "Add a video"}
                hint={`MP4 or MOV · up to ${VIDEO_SIZE_LABEL} and ${videoEntitlement.maxDurationSec}s each`}
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

          {/* Asked here, before Preview, not on the preview itself: there it sat under the ad card
            * and sellers kept tapping Post ad straight into "Tap Owner or Agent". */}
          {askSellerType && (
            <div
              ref={sellerTypeRef}
              className={`flex flex-col gap-2 max-w-[720px] rounded-[12px] p-3 border-2 ${
                sellerTypeMissing ? "border-[#b3413a] bg-[#fdf1f0]" : "border-border"
              }`}
            >
              <RequiredLabel text="Are you the owner or an agent?" />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["owner", "Owner"],
                    ["agent", "Agent / broker"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPostedAs(value);
                      setSellerTypeMissing(false);
                      setError(null);
                    }}
                    className={transactionButtonClass(postedAs === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-muted">
                Shown on your ads so buyers know who they&rsquo;re talking to. You can change it in
                your profile.
              </span>
            </div>
          )}

          <div className="flex gap-2.5 max-w-[720px]">
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
              onClick={() => void onPreview()}
              disabled={!detailsValid}
              className={`ml-auto ${primaryButtonClass}`}
            >
              {preparingMedia ? "Preparing media…" : "Preview Ad"}
            </button>
          </div>
          {detailsIssue && !preparingMedia && (
            <p
              className={`m-0 -mt-2 max-w-[720px] text-right text-[13px] ${detailsIssue.missing ? "text-muted" : "text-[#b3413a] font-bold"}`}
            >
              To preview: {detailsIssue.text}
            </p>
          )}
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
        <div className={`mx-auto ${showPublishPanelOnReview ? "max-w-[680px]" : "max-w-[340px]"}`}>
          <div
            className={
              showPublishPanelOnReview
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
                priceUnit={priceMode === "perUnit" && priceUnitAreaField ? currentAreaUnit : undefined}
                priceArea={priceArea}
                priceQualifier={priceQualifier}
                areaName={areaQuery}
                cityName={cities.find((c) => c.id === cityId)?.name ?? ""}
                attributes={attributes}
              />
            </div>

            {showPublishPanelOnReview && previewBoostDisplay && category && planPricingSettings && (
              <div className="w-full sm:flex-1">
                <BoostPlanSelector
                  pricing={previewBoostDisplay}
                  value={selectedBoostPlan}
                  onChange={setSelectedBoostPlan}
                  category={category}
                  platformFeeSettings={planPricingSettings.platformFee}
                  showBoostOptions={showBoostOnReview}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-3">
          {slotCap ? (
            <ListingSlotCapPrompt slotCap={slotCap} />
          ) : error ? (
            <p className="text-[#b3413a] text-[13px]">{error}</p>
          ) : publishCheckoutError ? (
            <div className="flex flex-col gap-2">
              <p className="text-[#b3413a] text-[13px] m-0">{publishCheckoutError}</p>
              {createdListing?.publishState === "pending_checkout" && (
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void finishPublishCheckout(createdListing).then((ok) => ok && setStep("success"))}
                >
                  Retry payment
                </button>
              )}
            </div>
          ) : null}

          <p className="m-0 text-[12px] text-muted">
            {assistedMode
              ? "Saved hidden. It goes live when the seller signs in with their phone and presses Publish."
              : "Your phone/email may be shown to users who unlock this listing\u2019s contact details."}
          </p>

          <div className="flex gap-2.5">
            <button
              onClick={backToDetails}
              className={secondaryButtonClass}
            >
              ← Back
            </button>
            <button
              onClick={handlePostAdClick}
              disabled={pending}
              className={`ml-auto ${primaryButtonClass}`}
            >
              {pending ? postAdButtonProgressText(uploadProgress) : assistedMode ? "Save for seller" : "Post ad"}
            </button>
          </div>
          </div>
        </div>
      )}

      {showBoostRecovery && previewBoostDisplay && (
        <BoostRecoveryDialog
          pricing={previewBoostDisplay}
          effectiveness={planPricingSettings?.boostEffectiveness ?? null}
          onAddBoost={handleBoostRecoveryAddBoost}
          onSkip={handleBoostRecoverySkip}
        />
      )}

      {step === "success" && createdListing && assistedMode && (
        <div className="w-full max-w-[440px] mx-auto flex flex-col items-center gap-5 py-4 px-1">
          <div className="text-center">
            <div className="font-lora text-xl sm:text-2xl font-bold text-text">Saved for {assistedSeller.name.trim()}</div>
            <p className="text-sm text-muted mt-1 mb-0">Hidden until they claim it.</p>
          </div>
          <AssistedClaimLinkPanel
            claimUrl={createdListing.assisted?.claimUrl ?? `${SITE_URL}/claim/${createdListing.id}?via=assisted`}
            sellerName={assistedSeller.name}
            sellerPhone={assistedSeller.phone}
            title={createdListing.title}
          />
          {/* A full load, so the next ad starts from an empty wizard rather than this one's state. */}
          <button
            type="button"
            onClick={() => window.location.assign("/post")}
            className="text-[13px] font-bold text-muted hover:text-text transition-colors bg-transparent border-0 cursor-pointer"
          >
            Post another ad &rarr;
          </button>
        </div>
      )}

      {step === "success" && createdListing && !assistedMode && (
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
                      {`Payment for your ${selectedBoostPlan.duration}-day Boost didn’t go through.`}
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

          <OwnerWhatsAppShare
            listing={createdListing}
            placement="post_success"
            variant="prominent"
          />

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
