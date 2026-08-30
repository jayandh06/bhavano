"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { pushDataLayerEvent } from "@/lib/gtm";

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
      <div className="flex gap-3 mt-2">
        {!isOwner && (
          <button
            onClick={onMessage}
            className="flex-1 bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer"
          >
            Contact owner
          </button>
        )}
        <button
          onClick={onToggleFavourite}
          className={`${isOwner ? "flex-1" : "w-[60px]"} bg-surface border-[1.5px] border-border rounded-lg py-2.5 text-[17px] cursor-pointer flex flex-col items-center gap-0.5 ${
            isFavourited ? "text-[#c0554b]" : ""
          }`}
        >
          <span>{isFavourited ? "♥" : "♡"}</span>
          <span className="text-[10px] font-bold text-muted">{likeCount}</span>
        </button>
      </div>
      {messageError && <p className="text-[#b3413a] text-[13px] mt-2">{messageError}</p>}
    </div>
  );
}
