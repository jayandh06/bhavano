import { formatInrWithWords, priceWordsNote } from "@bhavano/types/priceWords";

/** Live read-back under a price box — "₹35,00,000 (35 Lakh)" — so a seller or admin who typed
 * one zero too many sees it before saving. Nothing below ₹1,000, where there are no words. */
export function PriceWordsHint({ value, suffix = "" }: { value: string; suffix?: string }) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1_000) return null;
  return <div className="mt-1 text-[12px] text-muted">{formatInrWithWords(amount)}{suffix}</div>;
}

/** "₹35,00,000 (35 Lakh)" — the exact figure at the parent's size, the words smaller and muted
 * beside it. Renders just `price` for "Contact for price" or when no words came through. */
export function PriceWithWords({ price, priceInWords }: { price: string; priceInWords?: string | null }) {
  const note = priceWordsNote(price, priceInWords);
  return (
    <>
      {price}
      {note && <span className="ml-1.5 whitespace-nowrap text-[0.65em] font-semibold text-muted">({note})</span>}
    </>
  );
}
