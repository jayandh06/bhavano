import { useEffect, useRef, useState } from "react";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { deriveCardSpecs } from "@bhavano/types/cardSpecs";
import { deriveTag } from "@bhavano/types/listingTag";
import { areaUnitShortLabel, type AreaUnit } from "@bhavano/types/areaUnit";
import { formatInrInWords, groupInr, perUnitTotalPrice } from "@bhavano/types/priceWords";
import { Icon } from "./Icon";
import { ListingPrice } from "./PriceWithWords";

/**
 * What the actual browse-grid `ListingCard` will look like once this ad is posted — same photo/
 * badge/price/title/location/specs layout, deliberately not the same component. `ListingCard`
 * is built entirely around a persisted `ListingCardDto` (a real id, hosted photo URLs, view/like
 * counts, favourite/contact-reveal state) and wires up server actions for all of it — none of
 * which exist yet for a listing that hasn't been submitted. This renders from the wizard's own
 * in-progress, unsaved state instead, with no interactive controls (there is nothing to message,
 * favourite, or reveal on an ad that isn't live), using the exact same `deriveTag`/
 * `deriveCardSpecs` helpers the real card's data is built from server-side, so the badge and
 * specs chips can never drift from what the listing will actually show.
 *
 * The photos are local `URL.createObjectURL` blobs, not hosted `cdn.bhavano.com` URLs — plain
 * `<img>`, not next/image, since next.config.ts's `images.remotePatterns` only allows that one
 * remote host and a blob: URL is neither local-import nor a matching remote pattern.
 */
export function ListingPreviewCard({
  photoUrls,
  category,
  transactionType,
  title,
  price,
  priceUnit,
  priceArea,
  priceQualifier,
  areaName,
  cityName,
  attributes,
  featured = false,
}: {
  photoUrls: string[];
  category: ListingCategory;
  transactionType: TransactionType;
  title: string;
  /** Raw digits as typed, or empty/"0" for a price-on-request category — formatted here the
   * same way the real card's `₹`-prefixed, comma-grouped price is. When `priceUnit` is set, this
   * is the per-unit figure the seller typed (₹5,000); multiplied by `priceArea` it gives the total
   * the listing leads with, the rate beneath it, as on the real card. */
  price: string;
  priceUnit?: AreaUnit;
  priceArea?: number;
  priceQualifier: string;
  areaName: string;
  cityName: string;
  attributes: Record<string, unknown>;
  /** Mirrors `ListingCardDto.isBoosted` — whatever the wizard's Feature selection currently is
   * (`!!boostIntent` in PostAdWizard), not a persisted field, since this listing doesn't exist
   * yet. Drives the exact same border/badge treatment as the real `ListingCard` (see its own
   * `item.isBoosted` block) so this preview never promises a look the real card won't have. The
   * `key` below remounts on every toggle purely to replay the pulse animation — same blob: URL,
   * so the image itself doesn't re-fetch. */
  featured?: boolean;
}) {
  const priceNum = Number(price);
  const exactPrice =
    priceNum > 0 ? `₹${groupInr(priceNum)}${priceUnit ? `/${areaUnitShortLabel(priceUnit, priceNum)}` : ""}` : "Contact for price";
  const wordsPrice =
    priceNum > 0 ? `${formatInrInWords(priceNum)}${priceUnit ? `/${areaUnitShortLabel(priceUnit, 1)}` : ""}` : null;
  const totalPrice =
    priceNum > 0 && priceUnit && priceArea && priceArea > 0
      ? perUnitTotalPrice(Math.round(priceNum * priceArea), priceArea, priceUnit)
      : null;
  const specs = deriveCardSpecs(category, attributes);

  // Same cycle as the real ListingCard.tsx, gated the same way on *whether* it runs at all — only
  // a Featured listing with more than one photo gets it, since that's exactly what the real card
  // will (or won't) do once this is live. Unlike the real grid, it isn't gated on hover or
  // visibility at all: this is the one card on screen while actively editing the form, not one of
  // dozens competing for LCP budget, so there's no reason to wait for a gesture — it just always
  // runs, on every device, the moment the condition holds.
  const [cyclePhotoIndex, setCyclePhotoIndex] = useState(0);
  const cycleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canCyclePhotos = featured && photoUrls.length > 1;

  useEffect(() => {
    if (!canCyclePhotos) return;
    cycleIntervalRef.current = setInterval(() => {
      setCyclePhotoIndex((i) => (i + 1) % photoUrls.length);
    }, 1200);
    return () => {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
        cycleIntervalRef.current = null;
      }
      setCyclePhotoIndex(0);
    };
  }, [canCyclePhotos, photoUrls.length]);

  return (
    <div>
      {/* Named explicitly, not left to the border alone to communicate — a 1.5px color
        * difference is easy to miss at a glance, especially the first time someone sees this
        * screen at all. */}
      <div
        key={featured ? "featured-caption" : "unfeatured-caption"}
        className={`text-center text-[12.5px] font-bold mb-2 animate-[fadein_0.4s_ease_both] ${featured ? "text-gold" : "text-muted"}`}
      >
        {featured ? "✨ Preview — Featured" : "Preview — standard listing"}
      </div>
      {/* max-w matches ListingGrid's own column floor (minmax(min(340px,100%),1fr)) — without a
        * cap this stretched to the full width of whatever wide container the wizard's other
        * steps use (the details step's inputs go up to 720px), which no card in the real grid is
        * ever that wide. mx-auto centers it in the leftover space rather than sitting flush
        * left, since nothing else on this screen anchors it to an edge. */}
      <div
        key={featured ? "featured" : "unfeatured"}
        className={`w-full max-w-[340px] mx-auto bg-surface rounded-2xl overflow-hidden flex flex-col transition-[box-shadow,border-color] duration-300 animate-[featurePulse_0.6s_ease-out] ${
          featured
            ? "border-[1.5px] border-gold/70 shadow-[0_2px_10px_rgba(201,161,90,0.22)]"
            : "border border-border/70"
        }`}
      >
        <div className="relative h-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not a next/image-eligible remote URL */}
          <img
            src={photoUrls[cyclePhotoIndex] ?? photoUrls[0]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="bg-green text-on-green text-[11px] font-bold px-2.5 py-1 rounded-md">
              {deriveTag({ category, transactionType })}
            </span>
            {featured && (
              <span className="bg-gold text-[#3a2e0f] text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                <Icon name="featured" filled /> Featured
              </span>
            )}
          </div>
          {canCyclePhotos && (
            <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-[#00000099] text-white text-[11px] font-bold px-2 py-1 rounded-md pointer-events-none">
              <Icon name="camera" /> {photoUrls.length}
            </span>
          )}
        </div>
        <div className="p-[18px] flex flex-col gap-2.5">
          <div className="flex justify-between items-start gap-2.5">
            <div className="font-lora text-xl font-bold text-green">
              <ListingPrice item={{ price: exactPrice, priceInWords: wordsPrice, totalPrice }} />
            </div>
            {priceQualifier && (
              <div className="text-xs font-bold text-muted bg-surface-alt px-2.5 py-1 rounded-md whitespace-nowrap">
                {priceQualifier}
              </div>
            )}
          </div>
          <div className="text-[15px] font-bold text-text leading-[1.35]">{title || "Untitled listing"}</div>
          <div className="text-[13px] text-muted flex items-center gap-[5px]">
            <Icon name="pin" /> {areaName}, {cityName}
          </div>
          {specs.length > 0 && (
            <div className="flex gap-3.5 text-[13px] text-text-soft font-semibold pt-0.5">
              {specs.map((spec) => (
                <span key={spec}>{spec}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
