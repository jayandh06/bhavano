"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";

export function ListingDetailActions({
  listingId,
  initialIsFavourited,
  initialLikeCount,
  isOwner,
}: {
  listingId: string;
  initialIsFavourited: boolean;
  initialLikeCount: number;
  /** The poster's own view. Contact is hidden — it would start a conversation with yourself,
   * and offering it reads as the page not knowing whose ad it is. Favourite stays: an owner
   * bookmarking their own listing is harmless and the like count is part of how the page reads. */
  isOwner: boolean;
}) {
  const { requireLogin } = useAuthGate();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(initialIsFavourited);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [messageError, setMessageError] = useState<string | null>(null);

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
      requireLogin();
      return;
    }
    if ("error" in result) {
      setMessageError(result.error);
      return;
    }
    pushDataLayerEvent("contact_owner", { listingId });
    router.push(`/messages/${result.conversationId}`);
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
            {/* Credit/free-quota-gated contact reveal — not wired up yet (see
                docs/plans/contact-reveal-credits.md once that lands). Shown disabled rather than
                omitted so the eventual layout doesn't shift, and so it's visibly "coming soon"
                rather than silently missing. */}
            <button
              disabled
              title="Coming soon"
              className="flex-1 bg-surface border-[1.5px] border-border rounded-lg py-2.5 text-muted opacity-50 cursor-not-allowed flex flex-col items-center gap-0.5"
            >
              <Icon name="phone" className="text-[19px]" />
              <span className="text-[10px] font-bold">View Contact</span>
            </button>
          </>
        )}
      </div>
      {messageError && <p className="text-[#b3413a] text-[13px] mt-2">{messageError}</p>}
    </div>
  );
}
