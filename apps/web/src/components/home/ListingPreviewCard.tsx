import type { ListingCategory, TransactionType } from "@bhavano/types";
import { deriveCardSpecs } from "@bhavano/types/cardSpecs";
import { deriveTag } from "@bhavano/types/listingTag";
import { Icon } from "./Icon";

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
 * The photo is a local `URL.createObjectURL` blob, not a hosted `cdn.bhavano.com` URL — plain
 * `<img>`, not next/image, since next.config.ts's `images.remotePatterns` only allows that one
 * remote host and a blob: URL is neither local-import nor a matching remote pattern.
 */
export function ListingPreviewCard({
  photoUrl,
  category,
  transactionType,
  title,
  price,
  priceQualifier,
  areaName,
  cityName,
  attributes,
}: {
  photoUrl: string;
  category: ListingCategory;
  transactionType: TransactionType;
  title: string;
  /** Raw digits as typed, or empty/"0" for a price-on-request category — formatted here the
   * same way the real card's `₹`-prefixed, comma-grouped price is. */
  price: string;
  priceQualifier: string;
  areaName: string;
  cityName: string;
  attributes: Record<string, unknown>;
}) {
  const priceNum = Number(price);
  const priceDisplay = priceNum > 0 ? `₹${priceNum.toLocaleString("en-IN")}` : "Contact for price";
  const specs = deriveCardSpecs(category, attributes);

  return (
    // max-w matches ListingGrid's own column floor (minmax(min(340px,100%),1fr)) — without a cap
    // this stretched to the full width of whatever wide container the wizard's other steps use
    // (the details step's inputs go up to 720px), which no card in the real grid is ever that
    // wide. mx-auto centers it in the leftover space rather than sitting flush left, since
    // nothing else on this screen anchors it to an edge.
    <div className="w-full max-w-[340px] mx-auto bg-surface border border-border/70 rounded-2xl overflow-hidden flex flex-col">
      <div className="relative h-[200px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not a next/image-eligible remote URL */}
        <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute top-3 left-3">
          <span className="bg-green text-on-green text-[11px] font-bold px-2.5 py-1 rounded-md">
            {deriveTag({ category, transactionType })}
          </span>
        </div>
      </div>
      <div className="p-[18px] flex flex-col gap-2.5">
        <div className="flex justify-between items-start gap-2.5">
          <div className="font-lora text-xl font-bold text-green">{priceDisplay}</div>
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
  );
}
