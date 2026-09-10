"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { useBuyCredits } from "./BuyCreditsProvider";
import { toggleFavouriteAction, revealContactAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
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
  const { buyCredits } = useBuyCredits();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(initialIsFavourited);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [contactRevealed, setContactRevealed] = useState(initialContactRevealed);
  const [ownerPhone, setOwnerPhone] = useState(initialOwnerPhone);
  const [ownerEmail, setOwnerEmail] = useState(initialOwnerEmail);
  const [revealPending, setRevealPending] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
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
      buyCredits({
        listingId,
        creditPackSize,
        creditPackPriceRupees,
        onPurchased: () => {
          // The webhook (not the checkout callback) grants the credit batch — give it a few
          // seconds, then retry the reveal, which should now succeed.
          setUnlocking(true);
          setTimeout(async () => {
            await onViewContact();
            setUnlocking(false);
          }, 4000);
        },
      });
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

    </div>
  );
}
