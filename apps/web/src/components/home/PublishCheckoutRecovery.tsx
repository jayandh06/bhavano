"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BoostPlanSelection, BoostPricingPreviewDto, ListingDetailDto, ListingCategory } from "@bhavano/types";
import { buildDisplayBoostPricing } from "@bhavano/types/boostPricing";
import { platformFeeApplies } from "@bhavano/types/platformFeePricing";
import { fetchMyListingAction } from "@/app/actions/listings";
import { fetchPostAdPlanPricingAction } from "@/app/actions/payments";
import { startListingPublishCheckout } from "@/lib/listingPublishCheckout";
import { BoostPlanSelector } from "./BoostPlanSelector";

type PlanPricingBundle = Awaited<ReturnType<typeof fetchPostAdPlanPricingAction>>;

const PublishCheckoutContext = createContext<{
  openPublishCheckout: (listing: ListingDetailDto) => void;
} | null>(null);

function usePublishCheckoutRecovery() {
  const ctx = useContext(PublishCheckoutContext);
  if (!ctx) throw new Error("PublishCheckoutRecovery components must be inside PublishCheckoutRecoveryProvider");
  return ctx;
}

export function PublishCheckoutRecoveryProvider({ children }: { children: ReactNode }) {
  const [listing, setListing] = useState<ListingDetailDto | null>(null);
  const router = useRouter();

  const close = useCallback(() => setListing(null), []);

  const onPublished = useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const value = useMemo(() => ({ openPublishCheckout: setListing }), []);

  return (
    <PublishCheckoutContext.Provider value={value}>
      {children}
      {listing && (
        <PublishCheckoutModal listing={listing} onClose={close} onPublished={onPublished} />
      )}
    </PublishCheckoutContext.Provider>
  );
}

/** Opens publish checkout when landing with `?openPublishCheckout=<listingId>`. */
export function AutoOpenPublishCheckout({ listings }: { listings: ListingDetailDto[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openPublishCheckout } = usePublishCheckoutRecovery();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const id = searchParams.get("openPublishCheckout");
    if (!id) return;
    const listing = listings.find((l) => l.id === id && l.publishState === "pending_checkout");
    if (!listing) return;
    firedRef.current = true;
    openPublishCheckout(listing);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("openPublishCheckout");
    router.replace(params.toString() ? `/my-listings?${params.toString()}` : "/my-listings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function CompletePublishPaymentButton({ listing }: { listing: ListingDetailDto }) {
  const { openPublishCheckout } = usePublishCheckoutRecovery();
  return (
    <button
      type="button"
      onClick={() => openPublishCheckout(listing)}
      className="text-[12.5px] font-bold text-on-green bg-green rounded-lg px-3 py-2 cursor-pointer border-0"
    >
      Complete payment to publish
    </button>
  );
}

function PublishCheckoutModal({
  listing,
  onClose,
  onPublished,
}: {
  listing: ListingDetailDto;
  onClose: () => void;
  onPublished: () => void;
}) {
  const category = listing.category as ListingCategory;
  const [planPricing, setPlanPricing] = useState<PlanPricingBundle | null>(null);
  const [selectedBoostPlan, setSelectedBoostPlan] = useState<BoostPlanSelection | null>({
    duration: 15,
    includeInstantAlerts: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetchPostAdPlanPricingAction().then(setPlanPricing).catch(() => setError("Couldn't load pricing — please try again."));
  }, []);

  const previewBoostDisplay: BoostPricingPreviewDto | null = useMemo(
    () =>
      planPricing
        ? buildDisplayBoostPricing(
            category,
            planPricing.boost,
            planPricing.instantAlerts,
            planPricing.activeDiscountPercent,
          )
        : null,
    [category, planPricing],
  );

  const showBoostOptions = !!(
    planPricing &&
    (previewBoostDisplay?.showSelectorOnPreview ||
      platformFeeApplies(category, planPricing.platformFee))
  );

  async function waitForListingLive(listingId: string): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
      const row = await fetchMyListingAction(listingId);
      if (row?.publishState === "live") return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  async function onPay() {
    setPending(true);
    setError(null);
    const checkout = await startListingPublishCheckout({
      listingId: listing.id,
      category: listing.category,
      boostSelection: showBoostOptions ? selectedBoostPlan : null,
    });
    if (checkout.outcome === "cancelled") {
      setError("Payment was cancelled — your ad is not live yet.");
      setPending(false);
      return;
    }
    if (checkout.outcome === "error") {
      setError(checkout.message);
      setPending(false);
      return;
    }
    if (checkout.outcome === "paid") {
      const live = await waitForListingLive(listing.id);
      if (!live) {
        setError("Payment received — still confirming publish. Please retry in a moment.");
        setPending(false);
        return;
      }
    }
    setPending(false);
    onPublished();
  }

  return (
    <div
      className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-[14px] w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-lora text-xl font-semibold m-0 mb-1">Complete payment to publish</h2>
        <p className="text-[13px] text-muted m-0 mb-4">
          <strong className="text-text">{listing.title}</strong> is not visible to buyers until checkout succeeds.
        </p>

        {!planPricing || !previewBoostDisplay ? (
          <p className="text-[13px] text-muted">Loading pricing…</p>
        ) : (
          <BoostPlanSelector
            pricing={previewBoostDisplay}
            value={selectedBoostPlan}
            onChange={setSelectedBoostPlan}
            category={category}
            platformFeeSettings={planPricing.platformFee}
            showBoostOptions={showBoostOptions}
          />
        )}

        {error && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{error}</p>}

        <div className="flex gap-2.5 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 bg-transparent border-[1.5px] border-border text-text rounded-lg py-3 text-sm font-bold cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void onPay()}
            disabled={pending || !planPricing}
            className="flex-1 bg-green text-on-green border-0 rounded-lg py-3 text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {pending ? "Processing…" : "Pay & publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
