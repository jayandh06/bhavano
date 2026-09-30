import {
  compactPrice,
  formatInrWithWords,
  listingHeadlinePrice,
  priceWordsNote,
  type ListingPriceFields,
} from "@bhavano/types/priceWords";

/** Live read-back under a price box — "₹35,00,000 (35 Lakh)" — so a seller or admin who typed
 * one zero too many sees it before saving. Nothing below ₹1,000, where there are no words. */
export function PriceWordsHint({ value, suffix = "" }: { value: string; suffix?: string }) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1_000) return null;
  return <div className="mt-1 text-[12px] text-muted">{formatInrWithWords(amount)}{suffix}</div>;
}

/** Under a per-unit price box: what the whole listing comes to — "= ₹60,00,000 (60 Lakh) for
 * 1,200 sq ft". Nothing until both the rate and the area are filled in. */
export function PerUnitTotalHint({ total, area }: { total: number | null; area: string | null }) {
  if (total === null || !(total > 0) || !area) return null;
  return (
    <div className="mt-0.5 text-[12px] font-semibold text-text-soft">
      = {formatInrWithWords(total)} for {area}
    </div>
  );
}

/** "₹35,00,000 (35 Lakh)" — the exact figure at the parent's size, the words smaller and muted
 * beside it. `compact` (browse cards) shows just "₹35 Lakh" from ₹1 lakh up. `rate` is a per-unit
 * listing's "₹5,000/sq ft · 1,200 sq ft", on its own smaller line. Renders just `price` for
 * "Contact for price" or when no words came through. */
export function PriceWithWords({
  price,
  priceInWords,
  compact = false,
  rate,
}: {
  price: string;
  priceInWords?: string | null;
  compact?: boolean;
  rate?: string | null;
}) {
  const note = compact ? null : priceWordsNote(price, priceInWords);
  return (
    <>
      {compact ? compactPrice(price, priceInWords) : price}
      {note && <span className="ml-1.5 whitespace-nowrap text-[0.65em] font-semibold text-muted">({note})</span>}
      {rate && <span className="block mt-0.5 font-sans text-[0.6em] font-semibold text-muted">{rate}</span>}
    </>
  );
}

/** A listing DTO's price — a per-unit listing leads with its total, the rate beneath. */
export function ListingPrice({ item, compact = false }: { item: ListingPriceFields; compact?: boolean }) {
  const { price, priceInWords, rate } = listingHeadlinePrice(item);
  return <PriceWithWords price={price} priceInWords={priceInWords} compact={compact} rate={rate} />;
}
