import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import type {
  Area,
  BoostPlanSelection,
  BoostPricingPreviewDto,
  City,
  CreatedVideoInput,
  ListingCategory,
  ListingDetailDto,
  ReverseGeocodeResultDto,
  SellerType,
  TransactionType,
} from "@bhavano/types";
import { buildDisplayBoostPricing } from "@bhavano/types/boostPricing";
import {
  fromBrokerDefault,
  hasFromBrokerField,
  POSTED_BY_FORM_LABEL,
  POSTED_BY_FORM_OPTIONS,
  sellerTypeFromBroker,
} from "@bhavano/types/sellerType";
import type { BoostPriceSettings } from "@bhavano/types/boostPricing";
import type { BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import {
  brokerageFeeIssue,
  brokerageFeeNote,
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  groupFieldsBySection,
  listingAttributesIssue,
  pruneHiddenAttributes,
  SECTION_LABELS,
  SECTION_ORDER,
  type FieldSection,
} from "@bhavano/types/categoryFields";
import { POST_CATEGORIES, POST_CATEGORY_GROUPS } from "@bhavano/types/postCategories";
import {
  AREA_NAME_MAX_LENGTH,
  clampPrice,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from "@bhavano/types/listingLimits";
import { listingPriceIssue } from "@bhavano/types/priceBounds";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from "@bhavano/types/priceQualifiers";
import { AREA_UNIT_LABELS, areaUnitShortLabel, formatArea, type AreaUnit } from "@bhavano/types/areaUnit";
import { MAX_VIDEO_BYTES, resolveVideoEntitlement } from "@bhavano/types/videoLimits";
import { runWithConcurrency } from "@bhavano/types/concurrencyPool";
import { useAppTheme } from "../../theme/ThemeContext";
import { TOKEN_KEY, useHomeSheets } from "../../context/HomeSheetsProvider";
import { Icon, isIconName, type IconName } from "../Icon";
import {
  BffError,
  createListing,
  fetchAiGenerateUsage,
  fetchAreas,
  fetchPlanPricing,
  friendlyErrorMessage,
  generateListingCopy,
  previewBoostPricing,
  updateListing,
  uploadPhoto,
  uploadVideo,
} from "../../lib/bffClient";
import { INDIAN_LANGUAGE_LABELS, INDIAN_LANGUAGES, type AiGenerateUsageDto, type IndianLanguage } from "@bhavano/types/listingCopyAssist";
import { getAnalyticsSessionId, recordAppPageView } from "../../lib/analyticsSession";
import { logPostAdSuccess, logPostError, logPostLoginRequired, logPostStepView } from "../../lib/firebaseAnalytics";
import {
  clearPostAdDraft,
  loadPostAdDraft,
  markPostAdDraftLeft,
  savePostAdDraft,
  type PostAdDraft,
} from "../../lib/postAdDraft";
import { startBoostCheckout } from "../../lib/boostCheckout";
import { startListingPublishCheckout } from "../../lib/listingPublishCheckout";
import { listingPublishRequiresCheckout } from "@bhavano/types/listingPublishPricing";
import { platformFeeApplies } from "@bhavano/types/platformFeePricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { fetchListingById } from "../../lib/bffClient";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { LocationMapPicker } from "./LocationMapPicker";
import { ErrorBoundary } from "../ErrorBoundary";
import { ScreenHeader } from "./ScreenHeader";
import { ACTIVE_PROMO_CODE } from "@bhavano/types/promoCode";
import { BoostBundleCard } from "./BoostBundleCard";
import { BoostPlanSelector } from "./BoostPlanSelector";
import { BoostRecoveryDialog } from "./BoostRecoveryDialog";
import { ListingPreviewCard } from "./ListingPreviewCard";
import { OwnerWhatsAppShare } from "./OwnerWhatsAppShare";
import { PerUnitTotalHint, PriceWordsHint } from "./PriceWithWords";
import { appWebUrl } from "../../lib/appWebUrl";
import { priceSuffix } from "../../lib/boostPriceDisplay";

type FieldConfig = (typeof CATEGORY_FIELD_CONFIG)[ListingCategory][number];

type SavedDraft = NonNullable<Awaited<ReturnType<typeof loadPostAdDraft>>>;

/** Same red as the website's RequiredLabel (`#b3413a`) — a mandatory field's label here used to
 * end in a plain, same-color " *", which read as part of the word rather than a requirement
 * marker the way the website's colored one does. */
function RequiredMark() {
  return <Text style={{ color: "#b3413a" }}> *</Text>;
}

/** "saved today" / "saved yesterday" / "saved 3 days ago" (drafts expire after 7 days). */
function draftAgeLabel(savedAt: number): string {
  const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0);
  const days = Math.round((startOfDay(Date.now()) - startOfDay(savedAt)) / 86_400_000);
  return days <= 0 ? "saved today" : days === 1 ? "saved yesterday" : `saved ${days} days ago`;
}

// Mirrors the website's identical success-screen pitch (PostAdWizard.tsx's own "Reach more
// buyers, faster" card) — same four benefits, same icons.
const BOOST_BENEFITS: [IconName, string][] = [
  ["featured", "A gold Featured badge on your ad"],
  ["check", "Ranks above regular listings in search"],
  ["check", "Rotates fairly through the top slots"],
  ["bell", "Instant Alerts included: told the moment someone messages or shows interest"],
];

/** Short two- or three-option fields stay inline as a segmented control — seeing every choice at
 * once is worth the row it costs. Anything longer (facing has eight) wraps chips over three rows
 * and pushes the rest of the form off screen, so it collapses to a single row that opens a picker
 * sheet instead. */
function isSegmented(field: FieldConfig): boolean {
  return (
    field.type === "select" &&
    !!field.options &&
    field.options.length <= 3 &&
    field.options.every((o) => o.label.length <= 12)
  );
}

/** Small whole numbers get a stepper rather than a keyboard: no keypad, no way to type "abc" or
 * a negative, and the value is visible without tapping in.
 *
 * Two ways in. `stepper: true` in the shared field config is the explicit one, and covers
 * bedrooms and bathrooms — which the naming rule below misses, since neither ends in "Count"
 * despite being exactly the same kind of question. The suffix rule stays for the furnishing and
 * amenity counts, which are numerous and would be tedious to flag one by one. */
function isCounter(field: FieldConfig): boolean {
  return field.type === "number" && (field.stepper === true || field.key.endsWith("Count"));
}

/** Upper bound from the field's own `maxDigits` (the config already carries it), defaulting to two
 * digits: nobody lists 100 balconies, and an unbounded field invites a typo that ships. */
function maxCountFor(field: FieldConfig): number {
  return 10 ** (field.maxDigits ?? 2) - 1;
}

/** Counters start at 0 and yes/no toggles at "no", so the form opens in a stated, submittable
 * state instead of a page of blanks the seller must confirm one by one. Only fields the seller
 * has not touched are seeded — selectCategory clears attributes first, so this never overwrites. */
function defaultAttributesFor(category: ListingCategory): Record<string, string | string[]> {
  const defaults: Record<string, string | string[]> = {};
  for (const field of CATEGORY_FIELD_CONFIG[category]) {
    // Not a counter whose minimum is above 0 (total floors): a seeded "0" is below it, and the BFF
    // rejected every post that left it untouched. Those start blank instead.
    if (isCounter(field)) {
      if ((field.min ?? 0) === 0) defaults[field.key] = "0";
    }
    // Multi-selects open on their first option (Family, for preferred tenant type) rather than
    // empty — the common answer, and it stops a required multi-select blocking submission before
    // the seller has looked at it. Still fully deselectable.
    else if (field.type === "multi-select" && field.options?.[0]) defaults[field.key] = [field.options[0].value];
    // Not "Posted by Broker / Agent": a preset "No" would label every agent's listing "Owner".
    // It starts from the account's answer instead (fromBrokerDefault), or blank.
    else if (field.key !== "fromBroker" && field.options?.some((o) => o.value === "no") && field.options.length === 2) {
      defaults[field.key] = "no";
    }
  }
  return defaults;
}

/** Keyboards can be bypassed — paste, autofill, and hardware keyboards all reach a number-pad
 * field — so digits are enforced on the value, not just requested via keyboardType. Mirrors the
 * web wizard's sanitizeWholeNumber + clampDigits. */
function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Truncates to the field's own `maxDigits`, so a percent field can't take a third digit. */
function clampDigits(value: string, maxDigits: number | undefined): string {
  return maxDigits === undefined ? value : value.slice(0, maxDigits);
}

/** Unlike every other numeric field here (counts, prices — always whole numbers), an area value
 * is routinely a decimal ("2.5 acres") — keeps digits and at most one decimal point. */
function sanitizeAreaInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** A `decimal` number field (brokerage %): an area-style decimal cut to 2 places, the shape the
 * BFF accepts. */
function sanitizePercentInput(value: string): string {
  const [whole, fraction] = sanitizeAreaInput(value).split(".");
  return fraction === undefined ? whole : `${whole}.${fraction.slice(0, 2)}`;
}

/** A price is what the listing is for; 0 or blank is not a listing — except for pg/coworking,
 * where "Contact for price" (0) is a legitimate posting, see PRICE_ON_REQUEST_CATEGORIES's own
 * doc comment. Kept as its own predicate so the Review gate and the inline message can never
 * disagree about what counts as valid. */
function priceIsValid(price: string, category: ListingCategory | null): boolean {
  return Number(price) > 0 || (category !== null && PRICE_ON_REQUEST_CATEGORIES.has(category));
}

/** Wide enough for any realistic rupee amount, narrow enough that a stuck key can't produce a
 * number the BFF then has to reject. */

const MAX_PHOTOS = 6;
// Matches MIN_PHOTOS in packages/types/src/photoLimits.ts — enforced again server-side
// (ListingsService.create), so this is a pre-submit UX check, not the only gate.
const MIN_PHOTOS = 3;
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska"];

interface SelectedVideo {
  uri: string;
  /** Read from the picker's own asset metadata — RN has no client-side ffprobe equivalent, but
   * unlike the website's browser-`<video>` trick this is never `undefined` in practice; still
   * only a courtesy check either way, since the server verifies via ffprobe regardless. */
  durationSec?: number;
}

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sell: "Sell",
  buy: "Buy",
  rent: "Rent out",
  lease: "Lease out",
};

type Step = "category" | "transactionType" | "details" | "review" | "success";

// Mirrors web PostAdWizard.tsx's own STEP_SYNTHETIC_PATH — kept in sync by hand, same as every
// other web/mobile pair of these constants in this app.
const STEP_SYNTHETIC_PATH: Record<Step, string | null> = {
  category: "/post/category",
  transactionType: "/post/transaction-type",
  details: "/post/details",
  review: "/post/preview",
  success: null,
};

/** The Post ad button's status text while `pending` — see docs/plans/posting-speed-and-progress.md.
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

export function PostAdWizard({
  cities,
  defaultCityId,
  accessToken,
  entry = "bottom_tab",
}: {
  cities: City[];
  defaultCityId?: string;
  /** Undefined for a logged-out visitor, who now gets the whole form — see `onSubmit`, matching
   * the website's own PostAdWizard. */
  accessToken?: string;
  /** Which on-site control sent this visitor here — see
   * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Threaded into every step's
   * analytics event, same as web's own `entry` prop. */
  entry?: string;
}) {
  const { colors } = useAppTheme();
  const { requireLogin, ensureVerifiedPhone, profile } = useHomeSheets();
  const router = useRouter();
  const [listingId] = useState(() => Crypto.randomUUID());

  // Same rule as the website's /post/page.tsx: at wizard time the listing doesn't exist yet to be
  // boosted, so only an active Agent Pro subscription can elevate the tier — falls back to the
  // default (unelevated) tier for a logged-out visitor exactly like the website does.
  const videoEntitlement = useMemo(
    () => resolveVideoEntitlement(profile ?? { agentProUntil: null }),
    [profile],
  );

  const [step, setStep] = useState<Step>("category");
  // The "details" step mounts everything at once — city picker, the whole grouped attribute
  // grid, price fields, photo/video pickers — commonly 30+ native views in a single Fabric
  // commit. On Android that has crashed with "IllegalStateException: addViewAt: Failed to
  // insert view [...] into parent [...] at index N", a different index each time (a race, not a
  // fixed bug in one view), which is the known signature of Android's Fabric child-index
  // bookkeeping losing a race against a very large batch of view insertions landing together.
  // Rendering the step's container in one commit and its actual content one tick later — into an
  // already-settled parent, exactly like LocationMapPicker's own deferred MapView mount below —
  // splits that one huge batch into two much smaller ones.
  const [detailsReady, setDetailsReady] = useState(false);
  useEffect(() => {
    if (step !== "details") {
      setDetailsReady(false);
      return;
    }
    // requestAnimationFrame, not a bare state update: a plain setState here can still flush in
    // the same native frame as the commit that triggered this effect, since nothing forces
    // Android's Choreographer to actually process a frame boundary in between — which is
    // exactly why this alone didn't stop the crash the first time. rAF hands control back to
    // the native event loop before the callback runs, guaranteeing the small first commit
    // (stepper + placeholder) genuinely finishes as its own frame before the big one starts.
    const raf = requestAnimationFrame(() => setDetailsReady(true));
    return () => cancelAnimationFrame(raf);
  }, [step]);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  // Mirrors the web wizard's StepTracker — scroll reset, a `post_step_view` Firebase event, and a
  // synthetic PageView for every step (not just Preview, as before this doc), which keeps the
  // route at /post so SoftNavAppPageViews never sees any of it. `entry` rides along on every one,
  // same reasoning as web's own StepTracker. `/post/success` is NOT written from here —
  // createListing sends this session's id, and the BFF records it itself once the listing
  // actually goes live, which survives a dropped request that a fire-and-forget call from here
  // would not. See docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void logPostStepView({ step, entry });
    const path = STEP_SYNTHETIC_PATH[step];
    // `loggedIn` rides along too — mirrors web StepTracker's own addition. Approximated from the
    // `accessToken` prop rather than re-reading SecureStore, same as every other `loggedIn` check
    // in this component.
    if (path) void recordAppPageView(`${path}?from=${encodeURIComponent(entry)}&loggedIn=${accessToken ? 1 : 0}`);
  }, [step, entry, accessToken]);
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const [cityId, setCityId] = useState(defaultCityId ?? cities[0]?.id ?? "");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const optionSheetRef = useRef<BottomSheetModal>(null);
  const [openField, setOpenField] = useState<FieldConfig | null>(null);
  /** Cities the map pin resolved that aren't in the `cities` prop. Kept separate rather than
   * copying the prop into state, so a later prop update can't be silently shadowed. */
  const [pinResolvedCities, setPinResolvedCities] = useState<City[]>([]);
  const [pinLookupNote, setPinLookupNote] = useState<string | null>(null);
  const cityOptions = useMemo(
    () => [...cities, ...pinResolvedCities.filter((p) => !cities.some((c) => c.id === p.id))],
    [cities, pinResolvedCities],
  );
  const [price, setPrice] = useState("");
  const [priceQualifier, setPriceQualifier] = useState("");
  // "Whole price vs price per unit" — see web's identical toggle in PostAdWizard.tsx for the
  // full reasoning. Only offered for a sell/lease listing whose category has an area field.
  const [priceMode, setPriceMode] = useState<"total" | "perUnit">("total");
  const [title, setTitle] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<Area[]>([]);
  const areaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [description, setDescription] = useState("");
  // AI "Generate" assist for title/description — see docs/plans/ai-listing-copy-assist.md.
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [aiGenerateError, setAiGenerateError] = useState<string | null>(null);
  // This step's own choice, not secondLanguageChoice below (the Featured-regenerate banner's own
  // picker) — that one is additive (English + a toggle to a second version); this one *replaces*
  // English and applies to both Title and Description, read fresh on every Generate tap.
  const [generationLanguage, setGenerationLanguage] = useState<IndianLanguage | "">("");
  const [generationLanguagePickerOpen, setGenerationLanguagePickerOpen] = useState(false);
  // See web's identical state for the full reasoning — shown next to the language picker so a
  // seller knows their daily cap before hitting it.
  const [aiUsage, setAiUsage] = useState<AiGenerateUsageDto | null>(null);
  const [secondLanguageChoice, setSecondLanguageChoice] = useState<IndianLanguage | "">("");
  const [secondLanguageDescription, setSecondLanguageDescription] = useState<string | null>(null);
  const [activeDescriptionLang, setActiveDescriptionLang] = useState<"en" | IndianLanguage>("en");
  const [showRegenerateBanner, setShowRegenerateBanner] = useState(false);
  const [regeneratedDescriptionReady, setRegeneratedDescriptionReady] = useState(false);
  const [regenerateApplying, setRegenerateApplying] = useState(false);
  const [regenerateApplied, setRegenerateApplied] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  // string[] for multi-select fields (preferredTenantTypes); the attributes column is JSONB and
  // typed Record<string, unknown> on the wire, so an array round-trips as-is.
  const [attributes, setAttributes] = useState<Record<string, string | string[]>>({});
  // Asked only while the profile has no answer and this listing's own "Posted by Broker / Agent"
  // field is blank. Once the profile has an answer, that field is pre-selected from it instead.
  const [postedAs, setPostedAs] = useState<SellerType | null>(null);
  const [sellerTypeMissing, setSellerTypeMissing] = useState(false);
  const categoryHasPostedBy = !!category && hasFromBrokerField(category);
  const askSellerType = !profile?.sellerType && !categoryHasPostedBy;
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [videos, setVideos] = useState<SelectedVideo[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Drives the submit button's status text during the upload sequence — see
  // docs/plans/posting-speed-and-progress.md. `fraction` is only ever set for the video phase
  // (byte-level progress needs the direct-XHR path video already uses; photos only report which
  // one is in flight, not bytes).
  const [uploadProgress, setUploadProgress] = useState<{
    phase: "photos" | "video" | "creating";
    current: number;
    total: number;
    fraction?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Messages about the photos just picked (too many, wrong format, too big). Deliberately NOT the
  // wizard's shared `error`: that one is also what the Preview screen prints above the Post button,
  // so a photo-limit note left there read as a problem with the ad being posted, and nothing
  // cleared it after the seller removed photos to get back under the limit. This one is shown only
  // beside the photo picker, and cleared by anything that changes the photos.
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  // 1-based photoNo values the server flagged as already in use elsewhere — see web's identical
  // state for why this is cleared on any photo list mutation.
  const [duplicatePhotoNos, setDuplicatePhotoNos] = useState<number[]>([]);
  const [createdListing, setCreatedListing] = useState<ListingDetailDto | null>(null);
  // Captured from onSubmit's own resolved token (accessToken prop, or the SecureStore fallback
  // right after a just-completed login) rather than reusing the prop directly — the two can be
  // momentarily out of sync immediately after requireLogin's onSuccess re-runs onSubmit, and
  // BoostBundleCard needs a token that's definitely valid the instant the success step appears.
  const [postAccessToken, setPostAccessToken] = useState<string | undefined>(accessToken);
  // Android only — see BoostBundleCard's own comment for why Android gets one combined card
  // instead of iOS's redirect-to-website buttons below, which have nothing to activate in-app.
  const [bundleActivating, setBundleActivating] = useState(false);
  // iOS only — fetched for display alongside the redirect-to-website buttons below so their
  // price shows up front, matching the desktop success screen and Android's BoostBundleCard.
  // Read-only preview call, no checkout: Apple's Guideline 3.1.1 (see the buttons' own comment)
  // is about processing a paid transaction in-app, not about showing what something costs before
  // sending the buyer to the website to actually pay.
  const [iosPricing, setIosPricing] = useState<BoostPricingPreviewDto | null>(null);
  // Public, no-login-required settings (GET /plans/pricing) — read as soon as the wizard mounts,
  // not gated on being logged in, since the Preview-step selector below has to work before the
  // "Post ad" tap that's this wizard's usual, deliberate point of first asking for an account
  // (see onSubmit's own comment). previewBoostPricing (used everywhere else pricing is shown) is
  // AuthGuard-protected and would force a premature login — see
  // docs/plans/boost-instant-alerts-preview-selector.md.
  const [planPricingSettings, setPlanPricingSettings] = useState<{
    boost: BoostPriceSettings;
    instantAlerts: InstantAlertsPriceSettings;
    platformFee: PlatformFeeSettings;
    activeDiscountPercent: number | null;
    boostEffectiveness: BoostEffectivenessDto | null;
  } | null>(null);
  const [publishCheckoutError, setPublishCheckoutError] = useState<string | null>(null);
  // A boost/instant-alerts choice made ahead of time on the review step — null means the
  // advertiser explicitly skipped it (see selectCategory's pre-fill and BoostPlanSelector's own
  // "Skip" affordance). Only ever read/acted on when previewBoostDisplay?.showSelectorOnPreview.
  const [selectedBoostPlan, setSelectedBoostPlan] = useState<BoostPlanSelection | null>(null);
  // Shown by BoostPlanSelector's onSkipAttempt the moment Skip is tapped, before the skip is
  // actually committed — see BoostRecoveryDialog.tsx. selectedBoostPlan is untouched while this is
  // open; Cancel is the deferred commit, Apply Feature just closes with the selection intact.
  const [showBoostRecovery, setShowBoostRecovery] = useState(false);
  const [boostCheckoutPending, setBoostCheckoutPending] = useState(false);
  // null until a checkout attempt (auto-fired right after posting, or a manual retry) resolves.
  // Drives the narrow "Finish boosting this listing" retry prompt on the success step — see that
  // block's own comment for why this can't just reuse BoostBundleCard's `bundleActivating`.
  const [boostCheckoutOutcome, setBoostCheckoutOutcome] = useState<"succeeded" | "failed" | null>(null);
  const boostAutoFiredRef = useRef(false);
  // Draft autosave (lib/postAdDraft.ts): nothing is saved until the restore attempt has run, so
  // an empty first render can't overwrite a saved draft; and nothing after the listing exists.
  const draftSavingRef = useRef(false);
  const userStartedRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // A draft from an earlier visit waits on the category step until the seller chooses to continue
  // it or start a new ad — resuming it unasked dropped people mid-form without realising why.
  const [offeredDraft, setOfferedDraft] = useState<SavedDraft | null>(null);

  function applyDraft(draft: PostAdDraft) {
    const savedCity = draft.city;
    if (savedCity && !cities.some((c) => c.id === savedCity.id)) {
      setPinResolvedCities((prev) => (prev.some((c) => c.id === savedCity.id) ? prev : [...prev, savedCity]));
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
    setDescription(draft.description ?? "");
    setPin(draft.pin);
    setAttributes(draft.attributes);
    setPhotoUris(draft.photoUris);
    setSelectedBoostPlan(draft.selectedBoostPlan);
    // The preview is only shown after the account check in onPreview, so resume one step back.
    setStep(draft.step === "review" ? "details" : draft.step);
  }

  useEffect(() => {
    let cancelled = false;
    void loadPostAdDraft().then((saved) => {
      if (cancelled) return;
      if (saved && !userStartedRef.current) {
        if (saved.resume) {
          applyDraft(saved.draft);
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
    // Runs once on mount; `cities` is only read to decide where a restored city goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => markPostAdDraftLeft(), []);

  function continueOfferedDraft() {
    if (!offeredDraft) return;
    userStartedRef.current = true;
    applyDraft(offeredDraft.draft);
    setOfferedDraft(null);
  }

  /** Only one draft is kept, and the new ad's autosave would replace it anyway — cleared now so
   * its photos can't come back attached to the new ad. */
  function discardOfferedDraft() {
    if (!offeredDraft) return;
    setOfferedDraft(null);
    void clearPostAdDraft();
  }

  useEffect(() => {
    if (!draftSavingRef.current || !category || step === "success") return;
    const timer = setTimeout(() => {
      if (!draftSavingRef.current) return;
      void savePostAdDraft({
        step,
        category,
        transactionType,
        price,
        priceQualifier,
        priceMode,
        title,
        cityId,
        city: cityOptions.find((c) => c.id === cityId) ?? null,
        areaQuery,
        areaId,
        description,
        pin,
        attributes,
        photoUris,
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
    cityOptions,
    areaQuery,
    areaId,
    description,
    pin,
    attributes,
    photoUris,
    selectedBoostPlan,
  ]);

  function startOver() {
    void clearPostAdDraft();
    setPhotoUris([]);
    setCategory(null);
    setTransactionType(null);
    setPrice("");
    setPriceQualifier("");
    setPriceMode("total");
    setTitle("");
    setCityId(defaultCityId ?? cities[0]?.id ?? "");
    setAreaQuery("");
    setAreaId(null);
    setDescription("");
    setPin(null);
    setAttributes({});
    setSelectedBoostPlan(null);
    setPinLookupNote(null);
    setError(null);
    setPhotoNotice(null);
    setDraftRestored(false);
    setStep("category");
  }

  useEffect(() => {
    let cancelled = false;
    fetchPlanPricing()
      .then((result) => {
        if (!cancelled) setPlanPricingSettings(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetches on token too, not just once on reaching the step — see web's identical effect for
  // why (a seller usually isn't logged in yet here, so the first attempt comes back empty).
  useEffect(() => {
    const activeToken = accessToken ?? postAccessToken;
    if (step !== "details" || !activeToken) return;
    let cancelled = false;
    fetchAiGenerateUsage(activeToken)
      .then((usage) => {
        if (!cancelled) setAiUsage(usage);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [step, accessToken, postAccessToken]);

  const previewBoostDisplay = useMemo(() => {
    if (!category || !planPricingSettings) return null;
    // Only once the seller has actually entered a number — see web PostAdWizard's identical
    // comment on this same guard.
    const value = Number(price);
    const priceContext =
      transactionType && price && Number.isFinite(value) && value > 0 ? { transactionType, value } : undefined;
    return buildDisplayBoostPricing(
      category,
      planPricingSettings.boost,
      planPricingSettings.activeDiscountPercent,
      priceContext,
    );
  }, [category, planPricingSettings, transactionType, price]);

  const showPublishPanelOnReview = !!(
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
  // create(), and finishPublishCheckout's own boostSelection. See the web wizard's identical fix.
  const boostIntent = previewBoostDisplay?.showSelectorOnPreview ? selectedBoostPlan : null;

  // BoostPlanSelector's onSkipAttempt — makes the case before the skip is committed, not after.
  function handleBoostSkipAttempt() {
    setShowBoostRecovery(true);
  }

  // Dialog's Cancel — the deferred commit the Skip tap didn't make directly.
  function handleBoostRecoveryCancel() {
    setShowBoostRecovery(false);
    setSelectedBoostPlan(null);
    // A prior "Post ad" attempt can have left pending_checkout payment failed here (platform fee
    // + the boost just skipped, bundled into one checkout) — see web's identical comment in
    // PostAdWizard.tsx's handleBoostRecoverySkip. Clearing it lets "Post ad" start a clean retry.
    setPublishCheckoutError(null);
  }

  // Dialog's Apply Feature — selectedBoostPlan was never cleared, so there's nothing to restore.
  function handleBoostRecoveryApplyFeature() {
    setShowBoostRecovery(false);
  }

  async function waitForListingLive(listingId: string, token: string): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
      const listing = await fetchListingById(listingId, token);
      if (listing.publishState === "live") return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  async function finishPublishCheckout(listing: ListingDetailDto, token: string): Promise<boolean> {
    setPublishCheckoutError(null);
    if (Platform.OS === "ios") {
      await WebBrowser.openBrowserAsync(appWebUrl(`/my-listings?openBoost=${listing.id}`));
      setPublishCheckoutError("Complete payment on the website to publish your ad.");
      return false;
    }
    const checkout = await startListingPublishCheckout({
      accessToken: token,
      listingId: listing.id,
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
      const live = await waitForListingLive(listing.id, token);
      if (!live) {
        setPublishCheckoutError("Payment received — still confirming publish. Please retry in a moment.");
        return false;
      }
    }
    return true;
  }

  // Fires once, right after the listing actually exists, using whatever was chosen on the review
  // step. Android/web: the real in-app checkout. iOS: never an in-app checkout (Apple Guideline
  // 3.1.1) — instead the same website redirect the existing always-visible iOS buttons below use,
  // just opened automatically instead of waiting for a tap.
  useEffect(() => {
    if (boostAutoFiredRef.current) return;
    if (!createdListing || !postAccessToken || !selectedBoostPlan) return;
    if (!previewBoostDisplay?.showSelectorOnPreview) return;
    if (createdListing.publishState === "pending_checkout") return;
    boostAutoFiredRef.current = true;

    if (Platform.OS === "ios") {
      WebBrowser.openBrowserAsync(
        appWebUrl(`/my-listings?openBoost=${createdListing.id}`),
      );
      return;
    }

    setBoostCheckoutPending(true);
    startBoostCheckout({
      accessToken: postAccessToken,
      listingId: createdListing.id,
      duration: selectedBoostPlan.duration,
      includeInstantAlerts: selectedBoostPlan.includeInstantAlerts,
      discountCode: ACTIVE_PROMO_CODE,
    }).then((result) => {
      setBoostCheckoutPending(false);
      const succeeded = result.outcome === "activated" || result.outcome === "paid";
      setBoostCheckoutOutcome(succeeded ? "succeeded" : "failed");
      if (succeeded) setShowRegenerateBanner(true);
    });
  }, [createdListing, postAccessToken, selectedBoostPlan, previewBoostDisplay]);

  // Manual retry for the narrow success-step prompt — same call the auto-fire above makes,
  // re-run against the same pre-made selection (a fresh Razorpay order, same as re-tapping
  // BoostBundleCard's own button already does today).
  function retryBoostCheckout() {
    if (!createdListing || !postAccessToken || !selectedBoostPlan) return;
    setBoostCheckoutPending(true);
    setBoostCheckoutOutcome(null);
    startBoostCheckout({
      accessToken: postAccessToken,
      listingId: createdListing.id,
      duration: selectedBoostPlan.duration,
      includeInstantAlerts: selectedBoostPlan.includeInstantAlerts,
      discountCode: ACTIVE_PROMO_CODE,
    }).then((result) => {
      setBoostCheckoutPending(false);
      const succeeded = result.outcome === "activated" || result.outcome === "paid";
      setBoostCheckoutOutcome(succeeded ? "succeeded" : "failed");
      if (succeeded) setShowRegenerateBanner(true);
    });
  }

  useEffect(() => {
    if (Platform.OS !== "ios" || !createdListing || !postAccessToken) return;
    let cancelled = false;
    previewBoostPricing(postAccessToken, createdListing.category, ACTIVE_PROMO_CODE)
      .then((result) => {
        if (!cancelled) setIosPricing(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [createdListing, postAccessToken]);

  function selectCategory(next: ListingCategory) {
    userStartedRef.current = true;
    discardOfferedDraft();
    setCategory(next);
    setAttributes({ ...defaultAttributesFor(next), ...fromBrokerDefault(next, profile?.sellerType ?? null) });
    // A category swap can invalidate "price per unit" (the new category might have no area field
    // at all, or a different one) — reset to the plain default.
    setPriceMode("total");
    // Pre-filled default for the Preview-step selector (15-day boost + Instant Alerts) — set once,
    // here, rather than in a useEffect keyed on `category`, since that can't tell "never chosen
    // yet" apart from "explicitly skipped" (BoostPlanSelector's own Skip sets this back to null).
    setSelectedBoostPlan({ duration: 15, includeInstantAlerts: true });
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
    // Price-per-unit is sell/lease only — switching to rent must not carry a stale "perUnit"
    // mode forward into a combination the server would reject.
    if (next !== "sell" && next !== "lease") setPriceMode("total");
    setStep("details");
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const room = MAX_PHOTOS - photoUris.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: room,
    });
    if (result.canceled) return;

    setPhotoNotice(null);
    setDuplicatePhotoNos([]);
    const accepted: string[] = [];
    for (const asset of result.assets) {
      if (asset.mimeType && !ALLOWED_PHOTO_MIME_TYPES.includes(asset.mimeType)) {
        setPhotoNotice(`One of the selected photos isn't a supported format — use JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
        setPhotoNotice(`One of the selected photos is over the 4MB limit.`);
        continue;
      }
      accepted.push(asset.uri);
    }
    setPhotoUris((prev) => [...prev, ...accepted]);
  }

  function removePhoto(uri: string) {
    setPhotoNotice(null);
    setDuplicatePhotoNos([]);
    setPhotoUris((prev) => prev.filter((u) => u !== uri));
  }

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    setVideoError(null);
    if (videos.length >= videoEntitlement.maxVideos) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    if (asset.mimeType && !ALLOWED_VIDEO_MIME_TYPES.includes(asset.mimeType)) {
      setVideoError(`"${asset.fileName ?? "That video"}" isn't a supported format.`);
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
      setVideoError(`"${asset.fileName ?? "That video"}" is over the ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB limit.`);
      return;
    }
    // Courtesy check only — ffprobe on the server is the real authority (see SelectedVideo's own
    // doc comment), so an indeterminate duration never blocks the file.
    const durationSec = asset.duration ? asset.duration / 1000 : undefined;
    if (durationSec !== undefined && durationSec > videoEntitlement.maxDurationSec) {
      setVideoError(
        videoEntitlement.canUpgradeByBoosting
          ? `That video is longer than ${videoEntitlement.maxDurationSec}s. Feature this listing after posting to add longer videos.`
          : `That video is longer than the ${videoEntitlement.maxDurationSec}s limit.`,
      );
      return;
    }
    setVideos((prev) => [...prev, { uri: asset.uri, durationSec }]);
  }

  function removeVideo(uri: string) {
    setVideos((prev) => prev.filter((v) => v.uri !== uri));
  }

  function onAreaQueryChange(value: string) {
    setAreaQuery(value);
    setAreaId(null);

    if (areaDebounceRef.current) clearTimeout(areaDebounceRef.current);
    if (!value.trim() || !cityId) {
      setAreaSuggestions([]);
      return;
    }
    areaDebounceRef.current = setTimeout(async () => {
      setAreaSuggestions(await fetchAreas(cityId, value));
    }, 300);
  }

  function onPickArea(a: Area) {
    setAreaQuery(a.name);
    setAreaId(a.id);
    setAreaSuggestions([]);
  }

  function onCityChange(newCityId: string) {
    setCityId(newCityId);
    setAreaQuery("");
    setAreaId(null);
    setAreaSuggestions([]);
  }

  function countLabel(field: FieldConfig): string {
    const raw = attributes[field.key];
    if (typeof raw !== "string" || raw === "") return (field.min ?? 0) > 0 ? "-" : "0";
    return String(Number(raw) || 0);
  }

  function bumpCount(field: FieldConfig, delta: number) {
    setAttributes((prev) => {
      const raw = prev[field.key];
      const min = field.min ?? 0;
      if ((typeof raw !== "string" || raw === "") && delta < 0) return prev;
      const current = typeof raw === "string" ? Number(raw) || 0 : 0;
      const next = Math.min(maxCountFor(field), Math.max(min, current + delta));
      return { ...prev, [field.key]: String(next) };
    });
  }

  function toggleMulti(key: string, value: string) {
    setAttributes((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  /** One field's label + control, as a `styles.attrCell` (two fit per row — see the grid's own
   * comment). Returns an array rather than a single node so an `area` field with more than one
   * allowed unit (Plot/Commercial only) can render as two cells side by side — the number input
   * and, right beside it, its own Unit dropdown — instead of squeezing a unit picker inside the
   * same cell as the number, which is what pushed Dimensions/Facing out of a clean two-per-row
   * layout. The Unit dropdown reuses the same collapsed-select sheet every other select/multi-
   * select field opens, via a synthetic field whose `key` is the real field's own sibling
   * `${field.key}Unit` attribute — the sheet reads/writes that key with no special-casing. */
  function renderFieldCells(field: FieldConfig): ReactNode[] {
    const segmented = isSegmented(field);
    const counter = isCounter(field);
    const selectedOption = field.options?.find((o) => o.value === attributes[field.key]);
    const chosen = Array.isArray(attributes[field.key]) ? (attributes[field.key] as string[]) : [];
    const summaryLabel =
      field.type === "multi-select"
        ? field.options
            ?.filter((o) => chosen.includes(o.value))
            .map((o) => o.label)
            .join(", ") || null
        : (selectedOption?.label ?? null);

    const cells: ReactNode[] = [
      <View key={field.key} style={field.key === "fromBroker" ? styles.attrCellFull : styles.attrCell}>
        <Text style={[styles.label, { color: colors.textSoft }]} numberOfLines={2}>
          {field.key === "fromBroker" ? POSTED_BY_FORM_LABEL : field.label}
          {field.required && <RequiredMark />}
        </Text>
        {field.type === "area" ? (
          <TextInput
            value={typeof attributes[field.key] === "string" ? (attributes[field.key] as string) : ""}
            onChangeText={(v) => setAttributes((prev) => ({ ...prev, [field.key]: sanitizeAreaInput(v) }))}
            keyboardType="decimal-pad"
            placeholder={field.placeholder}
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
        ) : counter ? (
          <View style={[styles.counter, { borderColor: colors.border }]}>
            <Pressable
              onPress={() => bumpCount(field, -1)}
              hitSlop={8}
              style={[styles.counterButton, { borderRightWidth: 1, borderRightColor: colors.border }]}
            >
              {/* Plain ASCII hyphen, not the Unicode minus (−) this used to be — same
                * "not every font has this glyph" risk as the stepper arrow above, ASCII
                * is guaranteed to render everywhere. */}
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>-</Text>
            </Pressable>
            {/* Typing directly used to be impossible — the buttons were the only way in, which
              * made setting e.g. "4 bedrooms" four taps instead of one. Same digits-only +
              * clampDigits sanitizing as the plain number TextInput below, not a hard min/max
              * clamp while typing (that would make typing "15" impossible one keystroke at a
              * time if min were, say, 2) — out-of-range values are still caught at submit by
              * listingAttributesIssue, same as every other numeric field. */}
            <TextInput
              value={countLabel(field) === "-" ? "" : countLabel(field)}
              onChangeText={(v) =>
                setAttributes((prev) => ({ ...prev, [field.key]: clampDigits(digitsOnly(v), field.maxDigits ?? 2) }))
              }
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="-"
              placeholderTextColor={colors.muted}
              style={{ color: colors.text, fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center", padding: 0 }}
            />
            <Pressable
              onPress={() => bumpCount(field, 1)}
              hitSlop={8}
              style={[styles.counterButton, { borderLeftWidth: 1, borderLeftColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>+</Text>
            </Pressable>
          </View>
        ) : segmented ? (
          <View style={[styles.segmented, { borderColor: colors.border }]}>
            {(field.key === "fromBroker" ? POSTED_BY_FORM_OPTIONS : (field.options ?? [])).map((opt, i) => {
              const selected = attributes[field.key] === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setAttributes((prev) => ({ ...prev, [field.key]: opt.value }))}
                  style={[
                    styles.segment,
                    i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                    selected && { backgroundColor: colors.green },
                  ]}
                >
                  <Text
                    style={{ color: selected ? colors.onGreen : colors.text, fontSize: 12.5, fontWeight: "700" }}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : field.type === "multi-select" || field.type === "select" ? (
          <Pressable
            onPress={() => {
              setOpenField(field);
              optionSheetRef.current?.present();
            }}
            style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text
              style={{ color: summaryLabel ? colors.text : colors.muted, fontSize: 13.5, flex: 1 }}
              numberOfLines={1}
            >
              {summaryLabel ?? "Select…"}
            </Text>
            <Icon name="chevronDown" size={13} color={colors.muted} />
          </Pressable>
        ) : (
          <TextInput
            value={typeof attributes[field.key] === "string" ? (attributes[field.key] as string) : ""}
            onChangeText={(v) =>
              setAttributes((prev) => ({
                ...prev,
                [field.key]:
                  field.type !== "number"
                    ? v
                    : field.decimal
                      ? sanitizePercentInput(v)
                      : clampDigits(digitsOnly(v), field.maxDigits),
              }))
            }
            keyboardType={field.type === "number" ? (field.decimal ? "decimal-pad" : "number-pad") : "default"}
            placeholder={field.placeholder}
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
        )}
        {brokerageNote?.key === field.key && (
          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 4 }}>{brokerageNote.text}</Text>
        )}
      </View>,
    ];

    const unitOptions = field.type === "area" ? (field.units ?? ["sqft"]) : [];
    if (unitOptions.length > 1) {
      const currentUnit = (attributes[`${field.key}Unit`] as AreaUnit | undefined) ?? "sqft";
      const unitField: FieldConfig = {
        key: `${field.key}Unit`,
        label: "Unit",
        type: "select",
        options: unitOptions.map((u) => ({ value: u, label: AREA_UNIT_LABELS[u] })),
      };
      cells.push(
        <View key={`${field.key}-unit`} style={styles.attrCell}>
          <Text style={[styles.label, { color: colors.textSoft }]} numberOfLines={2}>
            Unit
          </Text>
          <Pressable
            onPress={() => {
              setOpenField(unitField);
              optionSheetRef.current?.present();
            }}
            style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.text, fontSize: 13.5, flex: 1 }} numberOfLines={1}>
              {AREA_UNIT_LABELS[currentUnit]}
            </Text>
            <Icon name="chevronDown" size={13} color={colors.muted} />
          </Pressable>
        </View>,
      );
    }

    return cells;
  }

  /** Google's City/Area resolution is a suggestion, never auto-locked — the user can still
   * change the City chip / Area field manually after the map pre-fills them.
   *
   * Applied directly when the pin resolves to a city. A pin outside every curated catchment does
   * not create a city — the area name is filled in and the seller picks the city. See
   * docs/plans/canonical-city-catchment.md. */
  function onPinChange(nextPin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) {
    setPin(nextPin);
    if (!suggestion) return;
    if (suggestion.cityId) {
      // The pin can resolve a city outside the `cities` prop (it holds popular cities only), in
      // which case selecting its id used to leave nothing selected in the picker and a blank city
      // on the review step. Carry it alongside, as the web wizard does with its own city list.
      if (!cities.some((c) => c.id === suggestion.cityId)) {
        setPinResolvedCities((prev) =>
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
      }
      onCityChange(suggestion.cityId);
      setPinLookupNote(null);
    } else {
      setPinLookupNote(
        suggestion.resolvedLocality
          ? `This place isn't inside a city we list. Pick the city, and we'll save ${suggestion.resolvedLocality} as the area.`
          : "Couldn't confidently match a city here — please pick City and Area below.",
      );
    }
    // `resolvedLocality` always comes back; `areaId` only when Google's locality matched an
    // existing Bhavano Area. Filling the text either way is the point of the pin — gating both on
    // areaId left the field blank for every locality we don't have a row for yet, which reads as
    // "the map did nothing". Without a match the id stays null, so submission sends `areaName` and
    // the area gets created, exactly as typing it by hand would.
    if (suggestion.resolvedLocality) {
      setAreaId(suggestion.areaId ?? null);
      setAreaQuery(suggestion.resolvedLocality);
      setAreaSuggestions([]);
    }
  }

  /** Mirrors the desktop wizard: a field appears only when it applies to this transaction type
   * and its `dependsOn` gate is satisfied. Without this mobile showed both brokerage amount
   * fields at once and showed them even when "Has brokerage fee" was No. */
  const visibleFields =
    category && transactionType
      ? CATEGORY_FIELD_CONFIG[category].filter((field) => fieldIsVisible(field, transactionType, attributes))
      : [];

  // "Whole price vs price per unit" is only offered for a sell/lease listing whose category has
  // an area field — see priceMode's own comment.
  const priceUnitAreaField =
    category && (transactionType === "sell" || transactionType === "lease")
      ? CATEGORY_FIELD_CONFIG[category].find((field) => field.type === "area")
      : undefined;
  const currentAreaUnit = (attributes[`${priceUnitAreaField?.key}Unit`] as AreaUnit | undefined) ?? "sqft";
  // Same range check the server makes, on the total — here so it's caught before the preview and
  // before any photo upload, not after tapping Post.
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

  // Same merge CategoryFieldsForm.tsx's `sectionExtras` does for the edit screen — the
  // Price/Price-per-unit/qualifier block below is folded into whichever position SECTION_ORDER
  // puts "pricing" at, category by category, rather than pinned above every other section
  // regardless of order. That fixed pin is what used to put "Pricing & fees" ahead of "Plot
  // details" here even after the website was reordered to put Plot details first — the price
  // toggle depends on the area/unit chosen there, so pricing has to render after it, not before.
  // `extraOnlySections` guarantees a "pricing" box exists even for a category with none of its
  // own pricing-section fields (pg/coworking has neither brokerage nor maintenance fee), since
  // the Price/qualifier inputs below must always show somewhere.
  const fieldSections = groupFieldsBySection(visibleFields);
  const orderIndex = (section: FieldSection | "other") =>
    section === "other" ? SECTION_ORDER.length : SECTION_ORDER.indexOf(section);
  const sections = fieldSections.some((s) => s.section === "pricing")
    ? fieldSections
    : [...fieldSections, { section: "pricing" as const, label: SECTION_LABELS.pricing, fields: [] as FieldConfig[] }].sort(
        (a, b) => orderIndex(a.section) - orderIndex(b.section),
      );

  // Everything the BFF would reject on Post ad, checked here instead, in form order — same list
  // as the web wizard's. `missing` is just not filled in yet; anything else has to change.
  // Every required-field check on this step except title/description, in display order — see
  // web's identical `otherFieldsIssue` for the full reasoning. Single source of truth for both
  // canGenerateCopy below and detailsIssue, which falls through to title/description only once
  // these are all satisfied.
  const otherFieldsIssue: { text: string; missing: boolean } | null = (() => {
    if (!cityId) return { text: "Pick a city", missing: true };
    if (areaQuery.trim().length === 0) return { text: "Add the area / locality", missing: true };
    if (!areaId && areaQuery.trim().length > AREA_NAME_MAX_LENGTH)
      return { text: `Area / locality must be ${AREA_NAME_MAX_LENGTH} characters or fewer`, missing: false };
    // Checked before the generic attribute sweep below so this field's own friendlier copy wins
    // over the generic "Posted by Broker / Agent is required" listingAttributesIssue would
    // otherwise produce — see the web wizard's identical comment for why.
    if (categoryHasPostedBy && !sellerTypeFromBroker(attributes.fromBroker))
      return { text: "Choose Owner or Broker / Agent under Posted by", missing: true };
    if (category && transactionType) {
      const attributeIssue = listingAttributesIssue(category, transactionType, attributes);
      if (attributeIssue) return { text: attributeIssue, missing: attributeIssue.endsWith(" is required") };
    }
    if (!priceIsValid(price, category)) return { text: "Add a price", missing: true };
    if (priceIssue) return { text: priceIssue, missing: false };
    const brokerageIssue = transactionType ? brokerageFeeIssue(transactionType, totalPrice, attributes) : null;
    if (brokerageIssue) return { text: brokerageIssue, missing: false };
    if (photoUris.length < MIN_PHOTOS) return { text: `Add at least ${MIN_PHOTOS} photos`, missing: true };
    if (askSellerType && !postedAs) return { text: "Choose Owner or Agent / broker", missing: true };
    return null;
  })();

  const detailsIssue: { text: string; missing: boolean } | null =
    otherFieldsIssue ??
    (() => {
      if (title.trim().length === 0) return { text: "Add a title", missing: true };
      if (title.trim().length < TITLE_MIN_LENGTH)
        return { text: `Title needs at least ${TITLE_MIN_LENGTH} characters`, missing: false };
      if (description.trim().length === 0) return { text: "Add a description", missing: true };
      if (description.trim().length < DESCRIPTION_MIN_LENGTH)
        return { text: `Description needs at least ${DESCRIPTION_MIN_LENGTH} characters`, missing: false };
      return null;
    })();
  const detailsValid = !detailsIssue;

  // AI Generate's whole purpose is to fill title/description, so requiring them first would be
  // circular — hence `otherFieldsIssue` alone. No listingId sent here: this component's own
  // listingId is a client-generated UUID for upload storage, not a real row yet.
  const canGenerateCopy = !!category && !!transactionType && !otherFieldsIssue;

  // `opts.listingId` switches this to the post-creation "regenerate with Featured" shape — see
  // docs/plans/ai-listing-copy-assist.md.
  async function handleGenerateCopy(field: "title" | "description", opts?: { listingId?: string; secondLanguage?: IndianLanguage }) {
    if (!opts?.listingId && (!canGenerateCopy || !category || !transactionType)) return;

    // Details-step call (no listingId) always generates both fields together now that there's a
    // single combined button for it — see web's identical reasoning. `field` is still threaded
    // through for the listingId/regenerate-banner call below, which stays single-field
    // (description only, Featured-tier) and unrelated to this.
    if (!opts?.listingId) {
      if (title.trim() || description.trim()) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Replace your current Title and Description?",
            "This will overwrite what you've typed with AI-generated versions.",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Replace", onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });
        if (!confirmed) return;
      }
    } else {
      const existing = field === "title" ? title : description;
      if (existing.trim()) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            `Replace your current ${field === "title" ? "Title" : "Description"}?`,
            "This will overwrite what you've typed with an AI-generated version.",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Replace", onPress: () => resolve(true) },
            ],
            // Android back-press dismisses without a button tap — without this the promise above
            // would hang and the field would silently never get replaced.
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });
        if (!confirmed) return;
      }
    }

    setAiGenerateError(null);

    let activeToken = accessToken ?? postAccessToken;
    if (!activeToken) {
      activeToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? undefined;
    }
    if (!activeToken) {
      requireLogin({ onSuccess: () => void handleGenerateCopy(field, opts) });
      return;
    }

    const fields: ("title" | "description")[] = opts?.listingId ? [field] : ["title", "description"];
    if (!opts?.listingId) {
      setGeneratingTitle(true);
      setGeneratingDescription(true);
    } else {
      (field === "title" ? setGeneratingTitle : setGeneratingDescription)(true);
    }
    try {
      const result = await generateListingCopy(
        opts?.listingId
          ? { listingId: opts.listingId, fields, secondLanguage: opts.secondLanguage }
          : {
              fields,
              category: category!,
              transactionType: transactionType!,
              price: Number(price) || undefined,
              priceQualifier: priceQualifier || undefined,
              cityName: cities.find((c) => c.id === cityId)?.name,
              areaName: areaQuery.trim() || undefined,
              attributes,
              lat: pin?.lat,
              lng: pin?.lng,
              language: generationLanguage || undefined,
            },
        activeToken,
      );
      if (result.title) setTitle(result.title.slice(0, TITLE_MAX_LENGTH));
      if (result.description) {
        // Reuses the same `description` state the details-step input binds to — nothing else
        // reads it once the listing already exists (success step), so it doubles as the
        // editable preview buffer for the regenerate-then-Apply flow.
        setDescription(result.description.slice(0, DESCRIPTION_MAX_LENGTH));
        setSecondLanguageDescription(result.descriptionSecondLanguage ?? null);
        setActiveDescriptionLang("en");
        if (opts?.listingId) {
          setRegeneratedDescriptionReady(true);
          setRegenerateApplied(false);
        }
      }
    } catch (error) {
      setAiGenerateError(friendlyErrorMessage(error, "Failed to generate"));
    } finally {
      if (!opts?.listingId) {
        setGeneratingTitle(false);
        setGeneratingDescription(false);
      } else {
        (field === "title" ? setGeneratingTitle : setGeneratingDescription)(false);
      }
      // The BFF's RateLimitGuard records a hit for any request that gets this far (success or
      // not) — see web's identical comment on handleGenerateCopy for the one excluded case.
      setAiUsage((prev) => (prev ? { ...prev, used: Math.min(prev.limit, prev.used + 1), remaining: Math.max(0, prev.remaining - 1) } : prev));
    }
  }

  // See web's identical function for the full reasoning on why this swap, not a new field.
  function switchDescriptionLang(lang: "en" | IndianLanguage) {
    if (lang === activeDescriptionLang || secondLanguageDescription === null) return;
    setDescription(secondLanguageDescription);
    setSecondLanguageDescription(description);
    setActiveDescriptionLang(lang);
  }

  async function applyRegeneratedDescription() {
    if (!createdListing) return;
    const activeToken = accessToken ?? postAccessToken;
    if (!activeToken) return;
    setRegenerateApplying(true);
    try {
      await updateListing(activeToken, createdListing.id, { description });
      setRegenerateApplied(true);
    } catch (error) {
      setAiGenerateError(friendlyErrorMessage(error, "Failed to save"));
    } finally {
      setRegenerateApplying(false);
    }
  }

  /**
   * "Preview Ad" — where the account is first asked for, matching the website's own
   * PostAdWizard. Nothing in this form touches the server before Submit, so the login waits until
   * the details are filled in and the user asks to preview, and `onSuccess` continues straight
   * to the preview. Re-reads SecureStore for the same stale-closure reason as onSubmit below.
   */
  async function onPreview() {
    let activeToken = accessToken;
    if (!activeToken) {
      activeToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? undefined;
    }
    setPhotoNotice(null);
    setError(null);
    setSellerTypeMissing(false);
    if (!activeToken) {
      void logPostLoginRequired({ step });
      void recordAppPageView(`/post/login-required?step=${encodeURIComponent(step)}`);
      requireLogin({ onSuccess: () => setStep("review") });
      return;
    }
    setStep("review");
  }

  /**
   * Submit. Still checks for an account itself: onPreview asked for one, but a session can lapse
   * between previewing and submitting.
   *
   * `accessToken` may still be the `undefined` this component mounted with even once logged in:
   * `requireLogin`'s `onSuccess` (below) fires synchronously right after the login sheet writes
   * the token to SecureStore, before React has re-rendered this component with the new prop —
   * so the resumed call re-reads SecureStore directly rather than trusting a closure that's
   * guaranteed to still be stale at that exact moment.
   */
  async function onSubmit() {
    if (!category || !transactionType) return;
    if (askSellerType && !postedAs) {
      setError(null);
      setSellerTypeMissing(true);
      setStep("details");
      return;
    }

    let activeToken = accessToken;
    if (!activeToken) {
      activeToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? undefined;
    }
    if (!activeToken) {
      void logPostLoginRequired({ step });
      void recordAppPageView(`/post/login-required?step=${encodeURIComponent(step)}`);
      requireLogin({ onSuccess: () => void onSubmit() });
      return;
    }
    setPostAccessToken(activeToken);

    // A verified phone is required to publish (buyers reach the seller by phone; it is also the
    // spam control) but login no longer collects one, so a Google/Apple account arrives here
    // without it. Ask now, before any upload; the sheet resumes this same call once verified.
    if (!(await ensureVerifiedPhone({ accessToken: activeToken, onSuccess: () => void onSubmit() }))) return;

    setPending(true);
    setError(null);
    setUploadProgress(null);
    try {
      // Uploaded with up to 3 in flight at once (runWithConcurrency) rather than one at a time —
      // see docs/plans/posting-speed-and-progress.md: sequential upload of every photo then every
      // video was the dominant cost in how slow posting felt, since server-side processing
      // (watermarking, variants) already runs in the background and never blocked this. 3 covers
      // MAX_PHOTOS (6) in two waves. `runWithConcurrency` preserves input order in its result
      // array regardless of completion order, and a thrown error rejects the whole call the same
      // way a single failed request aborted this loop before — no extra bookkeeping needed to keep
      // "a failed photo aborts the whole submit" working.
      let photosCompleted = 0;
      const photosPromise = runWithConcurrency(photoUris, 3, async (uri, i) => {
        const photoNo = i + 1;
        const upload = await uploadPhoto(uri, listingId, photoNo, activeToken);
        photosCompleted++;
        setUploadProgress({ phase: "photos", current: photosCompleted, total: photoUris.length });
        return { photoNo, hash: upload.hash, ext: upload.ext };
      });

      // Video never blocks the post — a failed upload is dropped and submission continues,
      // unlike a failed photo upload above (photos are required, video is additive).
      // ListingsService.create() also re-validates and silently trims against the caller's
      // current entitlement, so this array is best-effort even before it gets there.
      // Concurrency 2, not 3 like photos — matches the BFF's own global video-upload cap
      // (MAX_CONCURRENT_VIDEO_UPLOADS in video-upload.guard-rails.ts) exactly; going higher only
      // trades client-side parallelism for more 503s from that shared limit.
      let videosCompleted = 0;
      const videosPromise = runWithConcurrency(videos, 2, async (video, i) => {
        try {
          const result = await uploadVideo(video.uri, listingId, activeToken, (fraction) =>
            setUploadProgress({ phase: "video", current: i + 1, total: videos.length, fraction }),
          );
          videosCompleted++;
          setUploadProgress({ phase: "video", current: videosCompleted, total: videos.length });
          return result;
        } catch (uploadError) {
          setError(uploadError instanceof Error ? uploadError.message : "Failed to upload a video");
          return null;
        }
      });

      // Neither pool reads anything the other produces (both only need listingId/activeToken,
      // already resolved above) — run them together rather than finishing every photo before
      // starting the first video.
      const [uploadedPhotos, uploadedVideoResults] = await Promise.all([photosPromise, videosPromise]);
      const uploadedVideos = uploadedVideoResults.filter((r): r is CreatedVideoInput => r !== null);

      setUploadProgress({ phase: "creating", current: 1, total: 1 });

      const needsCheckout =
        category &&
        planPricingSettings &&
        listingPublishRequiresCheckout(category, planPricingSettings.platformFee, boostIntent);

      const listing = await createListing(
        {
          id: listingId,
          // Lets the BFF record the /post/success trail entry itself once this listing actually
          // goes live — see CreateListingInput.sessionId's own doc comment for why the client no
          // longer reports its own success (a fire-and-forget request that can silently drop).
          sessionId: getAnalyticsSessionId(),
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
          postedAs: profile?.sellerType ? undefined : (sellerTypeFromBroker(attributes.fromBroker) ?? postedAs ?? undefined),
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
        },
        activeToken,
      );

      setCreatedListing(listing);
      // The listing exists now (even if payment is still pending), so a retry must not recreate it.
      draftSavingRef.current = false;
      void clearPostAdDraft();
      if (listing.publishState === "pending_checkout") {
        const published = await finishPublishCheckout(listing, activeToken);
        if (!published) return;
      }
      void logPostAdSuccess({ category: listing.category, transactionType: listing.transactionType });
      setStep("success");
    } catch (e) {
      // Same "bounce back to Details with something to actually do about it" reasoning as
      // web's identical check — Review (if this app has one) has no photo-add/remove UI of its
      // own, so leaving the error here would be a dead end that only fails the same way again.
      if (e instanceof BffError && e.duplicatePhotoNos?.length) {
        setDuplicatePhotoNos(e.duplicatePhotoNos);
        setPhotoNotice(
          `${e.duplicatePhotoNos.length === 1 ? "The photo outlined in red" : "The photos outlined in red"} ` +
            `appear${e.duplicatePhotoNos.length === 1 ? "s" : ""} to already be in use on another listing — ` +
            `remove ${e.duplicatePhotoNos.length === 1 ? "it" : "them"} or replace with a different photo.`,
        );
        setStep("details");
        return;
      }
      const message = friendlyErrorMessage(e, "Failed to create listing");
      setError(message);
      // Mirrors web PostAdWizard.tsx's reportPostError — until now mobile had no trace anywhere
      // of a Publish failure, only success. See
      // docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md.
      void logPostError({ stage: step === "review" ? "publish" : step, message: message.slice(0, 140) });
      void recordAppPageView(
        `/post/error?stage=${encodeURIComponent(step === "review" ? "publish" : step)}&reason=${encodeURIComponent(message.slice(0, 140))}`,
      );
    } finally {
      setPending(false);
    }
  }

  // The step this wizard would land on if the visitor tapped back right now, or null on the
  // first step ("category"), which has nothing before it in the wizard. Centralizing this
  // (rather than each step computing its own bottom "Back" button, as before) is what lets a
  // single header back-arrow replace all three — see ScreenHeader below.
  function previousStep(): Step | null {
    if (step === "transactionType") return "category";
    if (step === "details") return category && POSTABLE_TRANSACTION_TYPES[category].length === 1 ? "category" : "transactionType";
    if (step === "review") return "details";
    return null;
  }
  const prevStep = previousStep();

  // react-native-keyboard-controller's KeyboardAwareScrollView — see ProfileFields' identical
  // comment for why this replaces a KeyboardAvoidingView+ScrollView pair: that combination only
  // shrinks the available space, it never scrolls a newly-focused field (this form's fields nest
  // inside several conditional sections — category, step, field type) into the space it shrunk.
  // Not wrapping the BottomSheetModal below (the option-picker sheet) — that already has its own
  // keyboard handling via gorhom's props, unrelated to this library.
  return (
    <>
    <View style={{ flex: 1 }}>
    <ScreenHeader
      title="Post an Ad"
      onBack={
        prevStep
          ? () => {
              if (step === "review") {
                setError(null);
                setSellerTypeMissing(false);
              }
              setStep(prevStep);
            }
          : undefined
      }
    />
    <KeyboardAwareScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
    >
      {step !== "success" && (
        // A vector icon, not a "→" text glyph, between steps — a Unicode arrow's rendering
        // depends on the device's own font having that glyph at all, which isn't guaranteed on
        // every Android font/OS version (it showed up missing/wrong on real Android devices,
        // while iOS's SF fonts always had it). An SVG icon has no such dependency.
        <View style={[styles.stepper, { alignItems: "center" }]}>
          {(["category", "transactionType", "details", "review"] as Step[]).map((s, i) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {i > 0 && <Icon name="chevronRight" size={11} color={colors.muted} />}
              <Text style={{ fontSize: 11, fontWeight: "700", color: step === s ? colors.green : colors.muted }}>
                {i + 1}. {s === "category" ? "Category" : s === "transactionType" ? "Transaction" : s === "details" ? "Details" : "Preview Ad"}
              </Text>
            </View>
          ))}
        </View>
      )}

      {draftRestored && step !== "success" && (
        // Deliberately loud: someone who tapped "Post ad" and landed mid-form, possibly in a
        // category they did not choose today, has to understand why before they publish into it.
        <View
          accessibilityRole="alert"
          style={{
            gap: 6,
            marginBottom: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.gold,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
            We restored the ad you were writing on this device
          </Text>
          <Text style={{ color: colors.textSoft, fontSize: 13 }}>
            {(() => {
              const label = POST_CATEGORIES.find((c) => c.value === category)?.label;
              return label ? `You are continuing your ${label} ad from where you left off. ` : "";
            })()}
            Check the category and details before you post, or start a new ad.
          </Text>
          <Pressable
            onPress={startOver}
            hitSlop={8}
            style={{
              alignSelf: "flex-start",
              marginTop: 4,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Start a new ad instead</Text>
          </Pressable>
        </View>
      )}

      {step === "category" && (
        <View style={{ gap: 22 }}>
          {offeredDraft && (
            <View
              accessibilityLabel="Unfinished ad"
              style={{
                gap: 6,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: colors.gold,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
                You have an unfinished ad on this device
              </Text>
              <Text style={{ color: colors.textSoft, fontSize: 13 }}>
                {[
                  POST_CATEGORIES.find((c) => c.value === offeredDraft.draft.category)?.label,
                  offeredDraft.draft.transactionType ? TRANSACTION_TYPE_LABELS[offeredDraft.draft.transactionType] : null,
                  offeredDraft.draft.title.trim() ? `“${offeredDraft.draft.title.trim()}”` : null,
                  offeredDraft.draft.photoUris.length > 0
                    ? `${offeredDraft.draft.photoUris.length} photo${offeredDraft.draft.photoUris.length === 1 ? "" : "s"}`
                    : null,
                  draftAgeLabel(offeredDraft.savedAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                <Pressable
                  onPress={continueOfferedDraft}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.green }}
                >
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5 }}>Continue this ad</Text>
                </Pressable>
                <Pressable
                  onPress={discardOfferedDraft}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: colors.green,
                  }}
                >
                  <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>Start a new ad</Text>
                </Pressable>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Picking a category below also starts a new ad and discards this one.
              </Text>
            </View>
          )}
          {POST_CATEGORY_GROUPS.map((group) => (
            <View key={group.title} style={{ gap: 10 }}>
              <Text style={[styles.groupHeading, { color: colors.textSoft }]}>{group.title.toUpperCase()}</Text>
              {group.options.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => selectCategory(c.value)}
                  style={[styles.optionButton, { borderColor: category === c.value ? colors.green : colors.border, backgroundColor: category === c.value ? colors.surfaceAlt : colors.surface }]}
                >
                  {isIconName(c.iconName) && (
                    <Icon name={c.iconName} size={18} color={category === c.value ? colors.green : colors.textSoft} />
                  )}
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {step === "transactionType" && category && (
        <View style={{ gap: 10 }}>
          {POSTABLE_TRANSACTION_TYPES[category].map((t) => (
            <Pressable
              key={t}
              onPress={() => selectTransactionType(t)}
              style={[styles.optionButton, { borderColor: transactionType === t ? colors.green : colors.border, backgroundColor: transactionType === t ? colors.surfaceAlt : colors.surface }]}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{TRANSACTION_TYPE_LABELS[t]}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {step === "details" && category && transactionType && !detailsReady && (
        // The one-commit-later placeholder itself — see detailsReady's own comment above for why
        // this exists. Keeps the step from flashing blank for that single frame.
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      )}

      {step === "details" && category && transactionType && detailsReady && (
        <View style={{ gap: 4 }}>
          <Text style={[styles.label, { color: colors.textSoft }]}>
            Pin your exact location (optional — helps buyers find you, and auto-fills City/Area below)
          </Text>
          {/* The pin picker is explicitly optional (see the label above it), and City/Area right
            * below are the real fallback — a native map failure (e.g. a missing/invalid Google
            * Maps API key, which react-native-maps can throw on rather than degrade from) must
            * not take the rest of this form down with it. */}
          <ErrorBoundary
            fallback={
              <Text style={[styles.label, { color: colors.muted, fontStyle: "italic" }]}>
                Map unavailable right now — pick your City/Area below instead.
              </Text>
            }
          >
            <LocationMapPicker
              defaultCenter={cityOptions.find((c) => c.id === cityId) ?? cities[0] ?? { lat: 20.5937, lng: 78.9629 }}
              initialPin={pin}
              onPinChange={onPinChange}
            />
          </ErrorBoundary>
          {pinLookupNote ? (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{pinLookupNote}</Text>
          ) : null}

          <Text style={[styles.label, { color: colors.textSoft }]}>
            City
            <RequiredMark />
          </Text>
          {/* Collapsed by default. Rendering a chip for every city pushed the rest of the form off
              screen and, worse, hid the fact that dropping a map pin had already chosen one —
              the selection was a subtly different chip background somewhere in a wall of chips. */}
          <Pressable
            onPress={() => setCityPickerOpen((open) => !open)}
            style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
              {cityOptions.find((c) => c.id === cityId)?.name ?? "Select a city"}
            </Text>
            <Text style={{ color: colors.green, fontSize: 12.5, fontWeight: "700" }}>
              {cityPickerOpen ? "Done" : "Change"}
            </Text>
          </Pressable>
          {cityPickerOpen && (
            <View style={styles.chipRow}>
              {cityOptions.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onCityChange(c.id);
                    setCityPickerOpen(false);
                  }}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: cityId === c.id ? colors.surfaceAlt : "transparent" }]}
                >
                  <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.label, { color: colors.textSoft }]}>
            Area / locality
            <RequiredMark />
          </Text>
          <TextInput
            value={areaQuery}
            onChangeText={onAreaQueryChange}
            placeholder="Start typing a locality…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {areaSuggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {areaSuggestions.map((a) => (
                <Pressable key={a.id} onPress={() => onPickArea(a)} style={styles.suggestionRow}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>{a.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!areaId && areaQuery.trim().length > 0 && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              No match selected — &quot;{areaQuery.trim()}&quot; will be added as a new area.
            </Text>
          )}

          {/* No Specs box, as on the website: the card's chips come from the category fields below
            * (deriveCardSpecs), so a typed "3 Beds" only repeated them in another spelling. */}
          <View style={[styles.divider, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
              {POST_CATEGORIES.find((c) => c.value === category)?.label} details
            </Text>
            {/* Grouped into the config's own sections (pricing, basics, preferences, …) in
                SECTION_ORDER, the same helper the desktop wizard uses and the same order it now
                renders in — Plot's "plotDetails" section comes before "pricing" there since the
                price toggle depends on the area/unit chosen in it, and `sections` (see its own
                comment above) puts them in that same order here. */}
            {sections.map(({ section, label, fields }) => (
            <View key={section}>
            <Text
              style={[
                styles.sectionHeading,
                { color: colors.green, backgroundColor: colors.surfaceAlt, borderLeftColor: colors.green },
              ]}
            >
              {label}
            </Text>
            {section === "pricing" && (
              <View style={{ gap: 4, marginBottom: 4 }}>
                {priceUnitAreaField && (
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => setPriceMode("total")}
                      style={[styles.chip, { borderColor: colors.border, backgroundColor: priceMode === "total" ? colors.surfaceAlt : "transparent" }]}
                    >
                      <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>Total price</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setPriceMode("perUnit")}
                      style={[styles.chip, { borderColor: colors.border, backgroundColor: priceMode === "perUnit" ? colors.surfaceAlt : "transparent" }]}
                    >
                      <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>
                        Price per {areaUnitShortLabel(currentAreaUnit, 1)}
                      </Text>
                    </Pressable>
                  </View>
                )}
                <Text style={[styles.label, { color: colors.textSoft }]}>
                  {priceMode === "perUnit" ? `Price per ${areaUnitShortLabel(currentAreaUnit, 1)} (₹)` : "Price (₹)"}
                  <RequiredMark />
                </Text>
                <TextInput
                  value={price}
                  onChangeText={(v) => setPrice(clampPrice(v, transactionType))}
                  keyboardType="number-pad"
                  placeholder="e.g. 25000"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                />
                <PriceWordsHint
                  value={price}
                  suffix={priceMode === "perUnit" ? ` per ${areaUnitShortLabel(currentAreaUnit, 1)}` : ""}
                />
                {pricedPerUnit && (
                  <PerUnitTotalHint total={totalPrice} area={priceArea > 0 ? formatArea(priceArea, currentAreaUnit) : null} />
                )}
                {price.length > 0 && !priceIsValid(price, category) ? (
                  <Text style={styles.fieldError}>Enter a price greater than 0.</Text>
                ) : priceIssue ? (
                  <Text style={styles.fieldError}>{priceIssue}</Text>
                ) : null}
                <Text style={[styles.label, { color: colors.textSoft }]}>Price qualifier *</Text>
                <View style={styles.chipRow}>
                  {getPriceQualifierOptions(category, transactionType).map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setPriceQualifier(opt.value)}
                      style={[styles.chip, { borderColor: colors.border, backgroundColor: priceQualifier === opt.value ? colors.surfaceAlt : "transparent" }]}
                    >
                      <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {/* Two per row: these are mostly one-word labels over a small control, so a full-width
                row wasted most of its width and made the section three screens long. */}
            {fields.length > 0 && <View style={styles.attrGrid}>{fields.flatMap(renderFieldCells)}</View>}
            </View>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSoft }]}>
            Photos ({MIN_PHOTOS}-{MAX_PHOTOS})
            <RequiredMark />
          </Text>
          {photoUris.length < MAX_PHOTOS && (
            <Pressable onPress={pickPhotos} style={[styles.photoButton, { borderColor: colors.green, backgroundColor: colors.surfaceAlt }]}>
              <Icon name="camera" size={24} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 15 }}>
                {photoUris.length > 0 ? "Add more photos" : "Add photos"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {MAX_PHOTOS - photoUris.length} more allowed
              </Text>
            </Pressable>
          )}
          {photoUris.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {photoUris.map((uri, i) => (
                <View key={uri}>
                  <Image
                    source={{ uri }}
                    style={[styles.photoThumb, duplicatePhotoNos.includes(i + 1) && { borderWidth: 2, borderColor: "#c0554b" }]}
                  />
                  <Pressable
                    onPress={() => removePhoto(uri)}
                    style={[styles.removeBadge, { backgroundColor: colors.surface }]}
                  >
                    <Icon name="close" size={13} color="#c0554b" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {photoNotice && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{photoNotice}</Text>}

          <Text style={[styles.label, { color: colors.textSoft, marginTop: 18 }]}>
            Video (optional, up to {videoEntitlement.maxVideos})
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Up to {videoEntitlement.maxDurationSec}s each.
            {videoEntitlement.canUpgradeByBoosting
              ? " Feature this listing after posting to add up to 3 videos, up to 2 minutes each."
              : ""}
          </Text>
          {videos.length < videoEntitlement.maxVideos && (
            <Pressable onPress={pickVideo} style={[styles.photoButton, { borderColor: colors.green, backgroundColor: colors.surfaceAlt, marginTop: 8 }]}>
              <Icon name="video" size={24} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 15 }}>
                {videos.length > 0 ? "Add another video" : "Add a video"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                MP4 or MOV · up to {videoEntitlement.maxDurationSec}s
              </Text>
            </Pressable>
          )}
          {videos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {videos.map((video) => (
                <View key={video.uri}>
                  {/* No live thumbnail/preview player — that needs expo-av/expo-video, a new
                      native dependency this app doesn't otherwise have, just to show what upload
                      already confirms happened. A duration badge is enough to say "this is your
                      video, and it's this long." */}
                  <View style={[styles.videoThumb, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <Icon name="video" size={22} color={colors.textSoft} />
                    {video.durationSec !== undefined && (
                      <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "700", marginTop: 4 }}>
                        {Math.round(video.durationSec)}s
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => removeVideo(video.uri)}
                    style={[styles.removeBadge, { backgroundColor: colors.surface }]}
                  >
                    <Icon name="close" size={13} color="#c0554b" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {videoError && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{videoError}</Text>}

          {error && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 8 }}>{error}</Text>}

          {/* Governs the combined AI Generate button below. Replaces English (unlike the
              Featured-regenerate banner's own picker further down, which is additive) — see
              generationLanguage's own comment above. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSoft }}>✨ AI-generate in:</Text>
            <Pressable
              onPress={() => setGenerationLanguagePickerOpen((open) => !open)}
              style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 0 }]}
            >
              <Text style={{ fontSize: 13, color: colors.text }}>
                {generationLanguage ? INDIAN_LANGUAGE_LABELS[generationLanguage] : "English"}
              </Text>
            </Pressable>
          </View>
          {generationLanguagePickerOpen && (
            <View style={[styles.readOnlyRow, { flexDirection: "column", alignItems: "stretch", borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable onPress={() => { setGenerationLanguage(""); setGenerationLanguagePickerOpen(false); }} style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, color: colors.text }}>English</Text>
              </Pressable>
              {INDIAN_LANGUAGES.map((lang) => (
                <Pressable key={lang} onPress={() => { setGenerationLanguage(lang); setGenerationLanguagePickerOpen(false); }} style={{ paddingVertical: 8 }}>
                  <Text style={{ fontSize: 13, color: colors.text }}>{INDIAN_LANGUAGE_LABELS[lang]}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {/* One button, not two — a single tap fills both fields together (handleGenerateCopy
              always requests both for this no-listingId call). Gold, not a plain bordered chip:
              this is the one control on this screen that writes fields for you, and a quieter
              style made it easy to miss. Gold is already this app's "something special" accent
              (colors.gold, reused from the boost/Featured badges above). */}
          <Pressable
            onPress={() => void handleGenerateCopy("title")}
            disabled={!canGenerateCopy || generatingTitle || generatingDescription}
            style={[
              styles.aiGenerateButton,
              {
                borderColor: colors.gold,
                backgroundColor: `${colors.gold}1a`,
                opacity: !canGenerateCopy || generatingTitle || generatingDescription ? 0.5 : 1,
              },
            ]}
          >
            {generatingTitle || generatingDescription ? (
              <ActivityIndicator size="small" color={colors.gold} />
            ) : (
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>✨ AI Generate Title + Description</Text>
            )}
          </Pressable>
          {aiUsage && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: aiUsage.remaining <= 0 ? "700" : "400",
                color: aiUsage.remaining <= 0 ? "#c0554b" : aiUsage.remaining <= 2 ? colors.gold : colors.muted,
              }}
            >
              {aiUsage.remaining <= 0
                ? "You've used today's AI-generate limit — try again tomorrow, or write it yourself."
                : `${aiUsage.remaining} of ${aiUsage.limit} AI generations left today.`}
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[styles.label, { color: colors.textSoft, marginTop: 0, marginBottom: 0 }]}>
              Title
              <RequiredMark />
            </Text>
            {/* Counts up rather than down, so it reads as progress instead of a warning, and
                turns amber before the cap rather than at it — running out mid-sentence is worth
                knowing a few characters early. */}
            <Text
              style={{
                fontSize: 12,
                color:
                  title.length >= TITLE_MAX_LENGTH
                    ? "#b3413a"
                    : title.length > TITLE_MAX_LENGTH - 20
                      ? colors.green
                      : colors.muted,
              }}
            >
              {title.length}/{TITLE_MAX_LENGTH}
            </Text>
          </View>
          <TextInput
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX_LENGTH))}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />

          <Text style={[styles.label, { color: colors.textSoft }]}>
            Description
            <RequiredMark />
          </Text>
          <TextInput
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX_LENGTH))}
            maxLength={DESCRIPTION_MAX_LENGTH}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholder="Describe the place in your own words — the layout, the neighbourhood, what's nearby."
            placeholderTextColor={colors.muted}
            style={[styles.input, { minHeight: 110, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            At least {DESCRIPTION_MIN_LENGTH} characters — ads with a real description get more responses.
          </Text>
          {aiGenerateError ? (
            <Text style={{ fontSize: 12, color: "#b3413a", marginTop: 4 }}>{aiGenerateError}</Text>
          ) : null}

          {/* Asked here, before Preview, not on the preview itself: there it sat under the ad card
            * and sellers kept tapping Post ad straight into the error. */}
          {askSellerType && (
            <View
              style={{
                gap: 6,
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: sellerTypeMissing ? "#c0554b" : colors.border,
                backgroundColor: sellerTypeMissing ? "#c0554b14" : "transparent",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                Are you the owner or an agent?
                <RequiredMark />
              </Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ["owner", "Owner"],
                    ["agent", "Agent / broker"],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setPostedAs(value);
                      setSellerTypeMissing(false);
                      setError(null);
                    }}
                    style={[
                      styles.chip,
                      {
                        borderColor: postedAs === value ? colors.green : colors.border,
                        backgroundColor: postedAs === value ? colors.surfaceAlt : "transparent",
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Shown on your ads so buyers know who they&rsquo;re talking to.
              </Text>
            </View>
          )}

          <View style={styles.navRow}>
            <Pressable
              onPress={() => void onPreview()}
              disabled={!detailsValid}
              style={[styles.reviewButton, { backgroundColor: colors.green, opacity: detailsValid ? 1 : 0.5 }]}
            >
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Preview Ad</Text>
            </Pressable>
          </View>
          {detailsIssue && (
            <Text
              style={{
                color: detailsIssue.missing ? colors.muted : "#c0554b",
                fontWeight: detailsIssue.missing ? "400" : "700",
                fontSize: 13,
                textAlign: "right",
                marginTop: 6,
              }}
            >
              To preview: {detailsIssue.text}
            </Text>
          )}
        </View>
      )}

      {step === "review" && category && transactionType && (
        <View style={{ gap: 12 }}>
          {/* What the actual browse-grid ListingCard will look like once this is posted — same
            * photo/badge/price/title/location/specs a buyer sees, not a plain text summary, so a
            * mistake (wrong cover photo, an odd-reading price, a spec that didn't come through) is
            * obvious here rather than after the ad is already live. Matches the web wizard's own
            * ListingPreviewCard. */}
          <ListingPreviewCard
            photoUris={photoUris}
            category={category}
            transactionType={transactionType}
            title={title}
            price={price}
            priceUnit={priceMode === "perUnit" && priceUnitAreaField ? currentAreaUnit : undefined}
            priceArea={priceArea}
            priceQualifier={priceQualifier}
            areaName={areaQuery}
            cityName={cityOptions.find((c) => c.id === cityId)?.name ?? ""}
            attributes={attributes}
            featured={!!boostIntent}
          />

          {showPublishPanelOnReview && previewBoostDisplay && category && planPricingSettings && (
            <BoostPlanSelector
              pricing={previewBoostDisplay}
              value={selectedBoostPlan}
              onChange={setSelectedBoostPlan}
              category={category}
              platformFeeSettings={planPricingSettings.platformFee}
              showBoostOptions={showBoostOnReview}
              onSkipAttempt={handleBoostSkipAttempt}
            />
          )}

          {showBoostRecovery && previewBoostDisplay && (
            <BoostRecoveryDialog
              pricing={previewBoostDisplay}
              effectiveness={planPricingSettings?.boostEffectiveness ?? null}
              onApplyFeature={handleBoostRecoveryApplyFeature}
              onCancel={handleBoostRecoveryCancel}
            />
          )}

          {(error || publishCheckoutError) && (
            <Text style={{ color: "#c0554b", fontSize: 13 }}>{error ?? publishCheckoutError}</Text>
          )}

          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Your phone/email may be shown to users who unlock this listing&rsquo;s contact details.
          </Text>

          <View style={styles.navRow}>
            <Pressable onPress={onSubmit} disabled={pending} style={[styles.submitButton, { backgroundColor: colors.green, opacity: pending ? 0.6 : 1 }]}>
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
                {pending ? postAdButtonProgressText(uploadProgress) : "Post ad"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "success" && createdListing && (
        <View style={{ alignItems: "center", gap: 20, paddingTop: 8 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={[styles.celebrateCircle, { backgroundColor: `${colors.green}1a` }]}>
              <Icon name="celebrate" size={26} color={colors.green} />
            </View>
            <Text style={{ fontFamily: "serif", fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" }}>
              Your ad is live!
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
              It&rsquo;s now visible to buyers searching your area.
            </Text>
          </View>

          {Platform.OS === "ios" ? (
            // iOS keeps the redirect-to-website button — a native Razorpay checkout for a paid
            // feature is exactly what Apple's Guideline 3.1.1 forbids here. `?openBoost=` deep-links
            // straight into the website's Boost dialog (see AutoOpenPurchaseModal.tsx on web), which
            // shows all three durations. Instant Alerts is part of every boost, so there is no
            // second button for it any more.
            <>
              <View style={[styles.boostCard, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icon name="boost" size={17} color={colors.gold} />
                  <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 15, color: colors.text }}>
                    Reach more buyers, faster
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  {BOOST_BENEFITS.map(([icon, text]) => (
                    <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Icon name={icon} size={14} color={colors.green} />
                      <Text style={{ flex: 1, fontSize: 13, color: colors.textSoft }}>{text}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() => WebBrowser.openBrowserAsync(appWebUrl(`/my-listings?openBoost=${createdListing.id}`))}
                  style={[styles.submitButton, { backgroundColor: colors.green, marginTop: 16 }]}
                >
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>
                    Feature this listing{priceSuffix(iosPricing?.boost7)}
                  </Text>
                </Pressable>
              </View>

            </>
          ) : previewBoostDisplay?.showSelectorOnPreview ? (
            // The full picker stays hidden here — the choice was already made on the review step
            // (BoostBundleCard's own showSelectorOnPreview self-gate covers this too, redundantly
            // safe). Only a narrow retry surfaces, and only while an actual attempt is
            // in-flight/failed — a skipped or already-succeeded plan renders nothing, per
            // docs/plans/boost-instant-alerts-preview-selector.md's mutual-exclusivity rule.
            selectedBoostPlan && (boostCheckoutPending || boostCheckoutOutcome === "failed") ? (
              <View style={[styles.boostCard, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>
                {boostCheckoutPending ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <ActivityIndicator color={colors.green} />
                    <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Finishing your Feature purchase…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, color: colors.textSoft, marginBottom: 12 }}>
                      {`Payment for your ${selectedBoostPlan.duration}-day Feature didn’t go through.`}
                    </Text>
                    <Pressable onPress={retryBoostCheckout} style={[styles.submitButton, { backgroundColor: colors.green }]}>
                      <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Finish featuring this listing</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null
          ) : bundleActivating ? (
            <View style={[styles.boostCard, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
              <Icon name="boost" size={16} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Featuring…</Text>
            </View>
          ) : (
            postAccessToken && (
              <BoostBundleCard
                listingId={createdListing.id}
                category={createdListing.category}
                accessToken={postAccessToken}
                onActivating={() => {
                  setBundleActivating(true);
                  setShowRegenerateBanner(true);
                }}
                effectiveness={planPricingSettings?.boostEffectiveness ?? null}
              />
            )
          )}

          {showRegenerateBanner && (
            <View style={[styles.boostCard, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt, gap: 10 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.text }}>
                  ✨ Your ad is now Featured — want a richer AI description with nearby landmarks?
                </Text>
                <Pressable onPress={() => setShowRegenerateBanner(false)}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>Dismiss</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <Pressable
                  onPress={() => setLanguagePickerOpen((open) => !open)}
                  style={[styles.readOnlyRow, { borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 0 }]}
                >
                  <Text style={{ fontSize: 13, color: colors.text }}>
                    {secondLanguageChoice ? `+ ${INDIAN_LANGUAGE_LABELS[secondLanguageChoice]}` : "English only"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    void handleGenerateCopy("description", {
                      listingId: createdListing.id,
                      secondLanguage: secondLanguageChoice || undefined,
                    })
                  }
                  disabled={generatingDescription}
                  style={[styles.submitButton, { backgroundColor: colors.green, opacity: generatingDescription ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>
                    {generatingDescription
                      ? "Generating…"
                      : regeneratedDescriptionReady
                        ? "✨ AI Regenerate"
                        : "✨ AI Generate"}
                  </Text>
                </Pressable>
              </View>

              {languagePickerOpen && (
                <View style={[styles.readOnlyRow, { flexDirection: "column", alignItems: "stretch", borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Pressable onPress={() => { setSecondLanguageChoice(""); setLanguagePickerOpen(false); }} style={{ paddingVertical: 8 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>English only</Text>
                  </Pressable>
                  {INDIAN_LANGUAGES.map((lang) => (
                    <Pressable key={lang} onPress={() => { setSecondLanguageChoice(lang); setLanguagePickerOpen(false); }} style={{ paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13, color: colors.text }}>+ {INDIAN_LANGUAGE_LABELS[lang]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {aiGenerateError ? <Text style={{ fontSize: 12, color: "#b3413a" }}>{aiGenerateError}</Text> : null}

              {regeneratedDescriptionReady && (
                <View style={{ gap: 8 }}>
                  {secondLanguageDescription !== null && secondLanguageChoice ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => switchDescriptionLang("en")}
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: activeDescriptionLang === "en" ? colors.green : colors.surface,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: activeDescriptionLang === "en" ? colors.onGreen : colors.muted }}>
                          English
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => switchDescriptionLang(secondLanguageChoice)}
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: activeDescriptionLang === secondLanguageChoice ? colors.green : colors.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: activeDescriptionLang === secondLanguageChoice ? colors.onGreen : colors.muted,
                          }}
                        >
                          {INDIAN_LANGUAGE_LABELS[secondLanguageChoice]}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <TextInput
                    value={description}
                    onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX_LENGTH))}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    style={[styles.input, { minHeight: 100, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pressable
                      onPress={() => void applyRegeneratedDescription()}
                      disabled={regenerateApplying}
                      style={[styles.submitButton, { backgroundColor: colors.green, opacity: regenerateApplying ? 0.6 : 1 }]}
                    >
                      <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>
                        {regenerateApplying ? "Saving…" : "Apply to my ad"}
                      </Text>
                    </Pressable>
                    {regenerateApplied ? (
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>Saved ✓</Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          )}

          <OwnerWhatsAppShare listing={createdListing} />

          {/* A real push (not the replace() this used to do straight out of onSubmit) — see this
              screen's own header comment for why that mattered: it's what makes the listing's
              back arrow have somewhere to return to. */}
          <Pressable
            onPress={() => router.push(`/listing/${createdListing.id}`)}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>View my ad</Text>
            <Icon name="chevronRight" size={12} color={colors.muted} />
          </Pressable>

        </View>
      )}
    </KeyboardAwareScrollView>
    </View>

    {/* One sheet reused by every collapsed select, driven by `openField` — a modal per field would
        mount a dozen sheets for a form the user mostly scrolls past. Sits outside the ScrollView
        so it isn't clipped by it. */}
    <BottomSheetModal
      ref={optionSheetRef}
      snapPoints={["50%"]}
      backgroundStyle={{ backgroundColor: colors.surface }}
      onDismiss={() => setOpenField(null)}
    >
      <BottomSheetView style={styles.optionSheet}>
        <Text style={[styles.optionSheetTitle, { color: colors.text }]}>{openField?.label}</Text>
        {openField?.options?.map((opt) => {
          const multi = openField.type === "multi-select";
          const current = attributes[openField.key];
          const selected = multi
            ? Array.isArray(current) && current.includes(opt.value)
            : current === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (multi) {
                  // Stays open: picking one tenant type usually means picking another, and a sheet
                  // that closes on every tap would have to be reopened for each.
                  toggleMulti(openField.key, opt.value);
                } else {
                  setAttributes((prev) => ({ ...prev, [openField.key]: opt.value }));
                  optionSheetRef.current?.dismiss();
                }
              }}
              style={styles.optionRow}
            >
              <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{opt.label}</Text>
              {selected && <Icon name="check" size={15} color={colors.green} />}
            </Pressable>
          );
        })}
        {openField?.type === "multi-select" && (
          <Pressable
            onPress={() => optionSheetRef.current?.dismiss()}
            style={[styles.doneButton, { backgroundColor: colors.green }]}
          >
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Done</Text>
          </Pressable>
        )}
      </BottomSheetView>
    </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  stepper: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  celebrateCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  boostCard: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 18 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
  groupHeading: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  readOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  aiGenerateButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    // A filled bar with a green rule down its left edge: at a glance the seller can see where one
    // group of fields ends and the next begins while scrolling, which a plain small-caps line
    // above a divider did not achieve.
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 22,
    marginBottom: 10,
    overflow: "hidden",
  },
  fieldError: { color: "#c0554b", fontSize: 12, marginTop: 4 },
  attrGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12 },
  attrCell: { width: "47%", flexGrow: 1 },
  // "Posted by" (fromBroker) alone gets the full row — same reasoning as the website's own
  // `col-span-full` for it. Squeezed into the usual 47% cell, "Broker / Agent" (POSTED_BY_FORM_
  // OPTIONS' swapped-in label, 15 chars) truncated: isSegmented's <=12-char check only ever saw
  // the field's real config options ("Yes"/"No"), never the longer label rendered in their place.
  attrCellFull: { width: "100%" },
  counter: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  counterButton: { paddingVertical: 9, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  optionSheet: { paddingHorizontal: 20, paddingBottom: 24 },
  optionSheetTitle: { fontWeight: "700", fontSize: 17, marginBottom: 12 },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  doneButton: { borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
  suggestionsBox: { borderWidth: 1, borderRadius: 9, marginTop: 6, overflow: "hidden" },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, paddingTop: 12, marginTop: 8, gap: 4 },
  // Dashed and taller than a plain button: it reads as "put something here" rather than as
  // another action competing with Continue, and photos are what decide whether a listing gets
  // opened at all.
  photoButton: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 20, alignItems: "center", gap: 6 },
  photoThumb: { width: 90, height: 90, borderRadius: 8 },
  videoThumb: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  // Was space-between, when this row still held a "Back" link on the left (now the header's
  // job) alongside the step's primary action — flex-end keeps that action anchored right.
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 16 },
  reviewButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  submitButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center" },
  reviewBox: { borderWidth: 1, borderRadius: 10, padding: 16 },
});
