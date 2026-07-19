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
}: {
  listingId: string;
  initialIsFavourited: boolean;
  initialLikeCount: number;
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
        <button
          onClick={requireLogin}
          className="flex-1 bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer"
        >
          Contact owner
        </button>
        <button
          onClick={requireLogin}
          className="bg-surface text-green border-[1.5px] border-green rounded-lg px-5 py-[13px] text-sm font-bold cursor-pointer"
        >
          Call
        </button>
        <button
          onClick={onToggleFavourite}
          className={`w-[60px] bg-surface border-[1.5px] border-border rounded-lg text-[17px] cursor-pointer flex flex-col items-center gap-0.5 ${
            isFavourited ? "text-[#c0554b]" : ""
          }`}
        >
          <span>{isFavourited ? "♥" : "♡"}</span>
          <span className="text-[10px] font-bold text-muted">{likeCount}</span>
        </button>
      </div>
      <button
        onClick={onMessage}
        className="w-full mt-2.5 bg-surface text-green border-[1.5px] border-green rounded-lg p-3 text-sm font-bold cursor-pointer"
      >
        💬 Message owner
      </button>
      {messageError && <p className="text-[#b3413a] text-[13px] mt-2">{messageError}</p>}
    </div>
  );
}
