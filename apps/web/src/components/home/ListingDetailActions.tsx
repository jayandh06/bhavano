"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction, revealContactAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { createContactRevealCreditsOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";

export function ListingDetailActions({
  listingId,
  initialIsFavourited,
  initialLikeCount,
  isOwner,
  initialContactRevealed,
  initialOwnerPhone,
  initialOwnerEmail,
  revealMethod,
  creditPackSize,
  creditPackPriceRupees,
}: {
  listingId: string;
  initialIsFavourited: boolean;
  initialLikeCount: number;
  /** The poster's own view. Contact is hidden — it would start a conversation with yourself,
   * and offering it reads as the page not knowing whose ad it is. Favourite stays: an owner
   * bookmarking their own listing is harmless and the like count is part of how the page reads. */
  isOwner: boolean;
  initialContactRevealed: boolean;
  initialOwnerPhone: string | null;
  initialOwnerEmail: string | null;
  /** Only meaningful when not yet revealed — what clicking "View Contact" will do. Undefined for
   * an anonymous viewer (not logged in yet), who gets the login gate first regardless. */
  revealMethod?: "free" | "credit" | "insufficient";
  creditPackSize?: number;
  creditPackPriceRupees?: number;
}) {
  const { requireLogin } = useAuthGate();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(initialIsFavourited);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [contactRevealed, setContactRevealed] = useState(initialContactRevealed);
  const [ownerPhone, setOwnerPhone] = useState(initialOwnerPhone);
  const [ownerEmail, setOwnerEmail] = useState(initialOwnerEmail);
  const [revealPending, setRevealPending] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [purchasePending, setPurchasePending] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  async function onToggleFavourite() {
    const result = await toggleFavouriteAction(listingId);
    if (result.requiresLogin) {
      requireLogin();
      return;
    }
    setIsFavourited(result.favourited);
    setLikeCount(result.likeCount);
  }

  async function onMessage() {
    setMessageError(null);
    const result = await startConversationAction(listingId);
    if (result.requiresLogin) {
      requireLogin({ onSuccess: () => void onMessage() });
      return;
    }
    if ("error" in result) {
      setMessageError(result.error);
      return;
    }
    pushDataLayerEvent("contact_owner", { listingId });
    router.push(`/messages/${result.conversationId}`);
  }

  async function onViewContact() {
    setRevealPending(true);
    setRevealError(null);
    const result = await revealContactAction(listingId);
    setRevealPending(false);

    if (result.requiresLogin) {
      requireLogin({ onSuccess: () => void onViewContact() });
      return;
    }
    if (result.insufficientCredits) {
      setShowPurchase(true);
      return;
    }
    if ("error" in result) {
      setRevealError(result.error);
      return;
    }
    setContactRevealed(true);
    setOwnerPhone(result.contact.ownerPhone);
    setOwnerEmail(result.contact.ownerEmail);
    pushDataLayerEvent("contact_reveal", { listingId });
  }

  async function onBuyCredits() {
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
      listingId,
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
            listingId,
            value: order.amount / 100,
            currency: order.currency,
          });
          setShowPurchase(false);
          setPurchasePending(false);
          setUnlocking(true);
          // The webhook (not this callback) is what actually grants the credit batch — give it
          // a few seconds, then retry the reveal, which should now succeed.
          setTimeout(async () => {
            await onViewContact();
            setUnlocking(false);
          }, 4000);
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
    <div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onToggleFavourite}
          title="Favourite"
          className={`flex-1 bg-surface border-[1.5px] border-border rounded-lg py-2.5 text-[17px] cursor-pointer flex flex-col items-center gap-0.5 ${
            isFavourited ? "text-[#c0554b]" : ""
          }`}
        >
          <Icon name="heart" filled={isFavourited} className="text-[19px]" />
          <span className="text-[10px] font-bold text-muted">{likeCount}</span>
        </button>
        {!isOwner && (
          <>
            <button
              onClick={onMessage}
              title="Message owner"
              className="flex-1 bg-surface border-[1.5px] border-border rounded-lg py-2.5 text-green cursor-pointer flex flex-col items-center gap-0.5"
            >
              <Icon name="message" className="text-[19px]" />
              <span className="text-[10px] font-bold">Message</span>
            </button>
            {!contactRevealed && (
              <button
                onClick={onViewContact}
                disabled={revealPending || unlocking}
                title={revealMethod === "credit" ? "Uses 1 credit" : revealMethod === "insufficient" ? "Buy credits to unlock" : "Free"}
                className="flex-1 bg-surface border-[1.5px] border-green rounded-lg py-2.5 text-green cursor-pointer flex flex-col items-center gap-0.5 disabled:opacity-60"
              >
                <Icon name="phone" className="text-[19px]" />
                <span className="text-[10px] font-bold">
                  {revealPending || unlocking ? "Unlocking…" : "View Contact"}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {messageError && <p className="text-[#b3413a] text-[13px] mt-2">{messageError}</p>}
      {revealError && <p className="text-[#b3413a] text-[13px] mt-2">{revealError}</p>}

      {!isOwner && contactRevealed && (ownerPhone || ownerEmail) && (
        <div className="mt-2 border-[1.5px] border-border rounded-lg p-3 flex flex-col gap-1.5">
          {ownerPhone && (
            <a href={`tel:${ownerPhone}`} className="flex items-center gap-2 text-[13px] font-bold text-text no-underline">
              <Icon name="phone" className="text-green" /> {ownerPhone}
            </a>
          )}
          {ownerEmail && (
            <a href={`mailto:${ownerEmail}`} className="flex items-center gap-2 text-[13px] font-bold text-text no-underline">
              ✉️ {ownerEmail}
            </a>
          )}
        </div>
      )}

      {showPurchase && (
        <div
          onClick={() => !purchasePending && setShowPurchase(false)}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[100] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[360px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="font-lora font-bold text-[17px] text-text mb-1">Buy contact-reveal credits</div>
            <p className="text-[13px] text-muted mb-4 m-0">
              You&rsquo;ve used your free reveals. {creditPackSize ?? 5} credits for ₹{creditPackPriceRupees ?? 125} —
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
              {purchasePending ? "Opening checkout…" : `Buy ${creditPackSize ?? 5} credits — ₹${creditPackPriceRupees ?? 125}`}
            </button>
            {purchaseError && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{purchaseError}</p>}
            <button
              onClick={() => setShowPurchase(false)}
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
