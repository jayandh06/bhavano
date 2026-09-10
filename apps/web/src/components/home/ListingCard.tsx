"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction, revealContactAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { createContactRevealCreditsOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { buildListingPath } from "@/lib/listingPath";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";

export function ListingCard({ item }: { item: ListingCardDto }) {
  const { requireLogin } = useAuthGate();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [contactError, setContactError] = useState<string | null>(null);
  const href = buildListingPath(item);

  const [contactRevealed, setContactRevealed] = useState(item.contactRevealed);
  const [ownerPhone, setOwnerPhone] = useState(item.ownerPhone);
  const [ownerEmail, setOwnerEmail] = useState(item.ownerEmail);
  const [revealPending, setRevealPending] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [purchasePending, setPurchasePending] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  async function onToggleFavourite(e: React.MouseEvent) {
    e.preventDefault();
    const result = await toggleFavouriteAction(item.id);
    if (result.requiresLogin) {
      requireLogin();
      return;
    }
    setIsFavourited(result.favourited);
    setLikeCount(result.likeCount);
  }

  // Whether login is needed is the server's answer, not a guess from client state: the action
  // returns `requiresLogin` when the session cookie is missing or the BFF rejects the token, so
  // an expired session opens the modal and a live one goes straight to the conversation. Asking
  // the client instead is what made this button open the login dialog even when signed in.
  // `onSuccess` resumes the same call once login completes, so the user isn't left having to tap
  // the button a second time.
  async function onMessage(e: React.MouseEvent) {
    e.preventDefault();
    setContactError(null);
    const result = await startConversationAction(item.id);
    if (result.requiresLogin) {
      requireLogin({ onSuccess: () => void onMessage(e) });
      return;
    }
    if ("error" in result) {
      setContactError(result.error);
      return;
    }
    pushDataLayerEvent("contact_owner", { listingId: item.id });
    router.push(`/messages/${result.conversationId}`);
  }

  async function onViewContact(e: React.MouseEvent) {
    e.preventDefault();
    setRevealPending(true);
    setContactError(null);
    const result = await revealContactAction(item.id);
    setRevealPending(false);

    if (result.requiresLogin) {
      requireLogin({ onSuccess: () => void onViewContact(e) });
      return;
    }
    if (result.insufficientCredits) {
      setShowPurchase(true);
      return;
    }
    if ("error" in result) {
      setContactError(result.error);
      return;
    }
    setContactRevealed(true);
    setOwnerPhone(result.contact.ownerPhone);
    setOwnerEmail(result.contact.ownerEmail);
    pushDataLayerEvent("contact_reveal", { listingId: item.id });
  }

  async function onBuyCredits(e: React.MouseEvent) {
    e.preventDefault();
    setPurchasePending(true);
    setPurchaseError(null);

    const result = await createContactRevealCreditsOrderAction(discountCode.trim() || undefined);
    if (!result.success) {
      setPurchasePending(false);
      setPurchaseError(result.error);
      return;
    }

    pushDataLayerEvent("begin_checkout_contact_reveal_credits", {
      transactionId: result.order.paymentId,
      listingId: item.id,
      value: result.order.amount / 100,
      currency: result.order.currency,
    });

    try {
      await loadRazorpayScript();
      const { order } = result;
      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Bhavano",
        description: "Contact reveal credits",
        handler: () => {
          pushDataLayerEvent("contact_reveal_credits_purchase", {
            transactionId: order.paymentId,
            listingId: item.id,
            value: order.amount / 100,
            currency: order.currency,
          });
          setShowPurchase(false);
          setPurchasePending(false);
          setTimeout(() => void onViewContact(e), 4000);
        },
        modal: { ondismiss: () => setPurchasePending(false) },
      });
      razorpay.open();
    } catch {
      setPurchasePending(false);
      setPurchaseError("Couldn't open checkout — please try again.");
    }
  }

  return (
    // sm:hover rather than plain hover: below that breakpoint is where touch-primary devices
    // live, and :hover there does not mean "the pointer is over this" the way it does with a
    // mouse — it means "this was the last thing tapped," which reads as the card staying stuck
    // highlighted rather than as an effect at all. Same shadow token the dropdown menus already
    // use, not a new one, so an elevated card matches what "elevated" already looks like
    // elsewhere in the app. Border and shadow only, no scale/translate: the grid's columns sit
    // close together, and a card that grows or shifts on hover jostles its neighbours' edges.
    // A faint resting shadow (border alone read flat against the page's own near-white bg) plus
    // a lighter border, since the two together at full strength double up on the same job.
    <div className="bg-surface border border-border/70 rounded-2xl overflow-hidden flex flex-col animate-[fadein_0.4s_ease_both] transition-[box-shadow,border-color] duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)] sm:hover:border-green/40 sm:hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <div
        className="relative h-[200px]"
        // Dynamic per-listing placeholder gradient stays inline — it's data, not a static style.
        style={
          item.photos[0]
            ? undefined
            : {
                background: `repeating-linear-gradient(135deg, ${item.imgColors[0]}, ${item.imgColors[0]} 14px, ${item.imgColors[1]} 14px, ${item.imgColors[1]} 28px)`,
              }
        }
      >
        {item.photos[0] && (
          <Image src={item.photos[0]} alt={item.title} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
        )}
        {/* TEMP(auth-gate): viewing listing details is open without login for now. */}
        <Link href={href} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center">
          {!item.photos[0] && (
            <span className="font-mono text-[11px] tracking-[0.04em] text-[#ffffffcc] bg-[#00000030] px-2.5 py-[5px] rounded-md">
              {item.imgLabel}
            </span>
          )}
        </Link>
        <div className="absolute top-3 left-3 flex gap-1.5 pointer-events-none">
          <span className="bg-green text-on-green text-[11px] font-bold px-2.5 py-1 rounded-md">{item.tag}</span>
          {item.isBoosted && (
            <span className="bg-gold text-[#3a2e0f] text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1"><Icon name="featured" filled /> Featured</span>
          )}
        </div>
        <button
          onClick={onToggleFavourite}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-[#ffffffee] border-none cursor-pointer text-[15px] z-[1] ${
            // This circle's background is a fixed near-white overlay on the photo, not a theme
            // color — so the icon's color must also be fixed (never `inherit`/theme text color),
            // or it silently disappears against the circle in dark mode (near-white on near-white).
            isFavourited ? "text-[#c0554b]" : "text-[#3a3a3a]"
          }`}
        >
          <Icon name="heart" filled={isFavourited} />
        </button>
      </div>

      <div className="p-[18px] flex flex-col gap-2.5 flex-1">
        {/* TEMP(auth-gate): viewing listing details is open without login for now. */}
        <Link href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2.5 text-inherit">
          <div className="flex justify-between items-start gap-2.5">
            <div className="font-lora text-xl font-bold text-green">{item.price}</div>
            {item.priceQualifier && (
              <div className="text-xs font-bold text-muted bg-surface-alt px-2.5 py-1 rounded-md whitespace-nowrap">
                {item.priceQualifier}
              </div>
            )}
          </div>
          <div className="text-[15px] font-bold text-text leading-[1.35]">{item.title}</div>
          <div className="text-[13px] text-muted flex items-center gap-[5px]">
            {/* The listing's own city, not the one being browsed. The all-cities views passed
              * "India" as a stand-in heading word, so every card read "Koramangala, India" — and
              * the app passed an empty string, giving "Koramangala, ". A card states where the
              * place is; that is never a property of the page it happens to appear on. */}
            <Icon name="pin" /> {item.area}, {item.cityName}
          </div>
          <div className="flex gap-3.5 text-[13px] text-text-soft font-semibold pt-0.5">
            {item.specs.map((spec) => (
              <span key={spec}>{spec}</span>
            ))}
          </div>
        </Link>
        {/* Views/likes and the contact actions share one row rather than stacking — the counts
          * sat above full-width buttons before, which cost the card an extra line. Owner's own
          * card still shows the counts here; the buttons just aren't part of the row for it.
          * No breakpoint prefixes in this block on purpose — one layout on a phone-width card
          * and a desktop grid card alike, not buttons that only appear past some screen size. */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex gap-3 text-[11.5px] text-muted shrink-0">
            <span className="flex items-center gap-1"><Icon name="eye" /> {item.viewCount}</span>
            <span className="flex items-center gap-1"><Icon name="heart" /> {likeCount}</span>
          </div>
          {/* Hidden on your own listing — the same reason as on the detail page, and more
            * visible here since a seller scrolling their own city sees the card among everyone
            * else's. */}
          {!item.isOwner && (
            <div className="flex gap-1.5">
              <button
                onClick={onMessage}
                className="flex items-center gap-1 bg-green/10 text-green border-none rounded-lg px-2.5 py-1.5 text-[12px] font-bold cursor-pointer whitespace-nowrap"
              >
                <Icon name="message" />
                Message
              </button>
              {contactRevealed ? (
                (ownerPhone || ownerEmail) && (
                  <a
                    href={`tel:${ownerPhone ?? ""}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 bg-green text-on-green border-none rounded-lg px-2.5 py-1.5 text-[12px] font-bold whitespace-nowrap no-underline"
                  >
                    <Icon name="phone" /> {ownerPhone ?? "Email"}
                  </a>
                )
              ) : (
                <button
                  onClick={onViewContact}
                  disabled={revealPending}
                  className="flex items-center gap-1 bg-green text-on-green border-none rounded-lg px-2.5 py-1.5 text-[12px] font-bold cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <Icon name="phone" />
                  {revealPending ? "Unlocking…" : "Contact"}
                </button>
              )}
            </div>
          )}
        </div>
        {contactError && <p className="text-[#b3413a] text-[12px] mt-1.5">{contactError}</p>}
      </div>

      {showPurchase && (
        <div
          onClick={(e) => {
            e.preventDefault();
            if (!purchasePending) setShowPurchase(false);
          }}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[100] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[360px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="font-lora font-bold text-[17px] text-text mb-1">Buy contact-reveal credits</div>
            <p className="text-[13px] text-muted mb-4 m-0">
              You&rsquo;ve used your free reveals. {item.creditPackSize ?? 5} credits for ₹{item.creditPackPriceRupees ?? 125} —
              each credit unlocks one listing&rsquo;s contact, permanently.
            </p>
            <label className="block text-[11.5px] font-bold text-muted mb-1.5">Discount code (optional)</label>
            <input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="e.g. LAUNCH25"
              className="w-full border-[1.5px] border-border rounded-[10px] px-3 py-2.5 text-sm text-text bg-surface mb-4"
            />
            <button
              onClick={onBuyCredits}
              disabled={purchasePending}
              className="w-full bg-green text-on-green border-0 rounded-lg py-3 text-sm font-extrabold cursor-pointer disabled:opacity-60"
            >
              {purchasePending ? "Opening checkout…" : `Buy ${item.creditPackSize ?? 5} credits — ₹${item.creditPackPriceRupees ?? 125}`}
            </button>
            {purchaseError && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{purchaseError}</p>}
            <button
              onClick={(e) => {
                e.preventDefault();
                if (!purchasePending) setShowPurchase(false);
              }}
              disabled={purchasePending}
              className="mt-4 bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
