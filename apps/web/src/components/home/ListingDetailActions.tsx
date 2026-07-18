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
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          onClick={requireLogin}
          style={{
            flex: 1,
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: 13,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Contact owner
        </button>
        <button
          onClick={requireLogin}
          style={{
            background: "var(--surface)",
            color: "var(--green)",
            border: "1.5px solid var(--green)",
            borderRadius: 8,
            padding: "13px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Call
        </button>
        <button
          onClick={onToggleFavourite}
          style={{
            width: 60,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            fontSize: 17,
            cursor: "pointer",
            color: isFavourited ? "#c0554b" : "inherit",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span>{isFavourited ? "♥" : "♡"}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{likeCount}</span>
        </button>
      </div>
      <button
        onClick={onMessage}
        style={{
          width: "100%",
          marginTop: 10,
          background: "var(--surface)",
          color: "var(--green)",
          border: "1.5px solid var(--green)",
          borderRadius: 8,
          padding: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        💬 Message owner
      </button>
      {messageError && <p style={{ color: "#b3413a", fontSize: 13, marginTop: 8 }}>{messageError}</p>}
    </div>
  );
}
