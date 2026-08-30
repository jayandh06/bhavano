"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { buildListingPath } from "@/lib/listingPath";
import { pushDataLayerEvent } from "@/lib/gtm";

export function ListingCard({ item, cityName }: { item: ListingCardDto; cityName: string }) {
  const { requireLogin } = useAuthGate();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [contactError, setContactError] = useState<string | null>(null);
  const href = buildListingPath(item);

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
  async function onContactOwner() {
    setContactError(null);
    const result = await startConversationAction(item.id);
    if (result.requiresLogin) {
      requireLogin();
      return;
    }
    if ("error" in result) {
      setContactError(result.error);
      return;
    }
    pushDataLayerEvent("contact_owner", { listingId: item.id });
    router.push(`/messages/${result.conversationId}`);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col animate-[fadein_0.4s_ease_both]">
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
            <span className="bg-gold text-[#3a2e0f] text-[11px] font-bold px-2.5 py-1 rounded-md">⭐ Featured</span>
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
          {isFavourited ? "♥" : "♡"}
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
            📍 {item.area}, {cityName}
          </div>
          <div className="flex gap-3.5 text-[13px] text-text-soft font-semibold pt-0.5">
            {item.specs.map((spec) => (
              <span key={spec}>{spec}</span>
            ))}
          </div>
          <div className="flex gap-3 text-[11.5px] text-muted">
            <span>👁 {item.viewCount}</span>
            <span>♥ {likeCount}</span>
          </div>
        </Link>
        {/* Hidden on your own listing — the same reason as on the detail page, and more visible
          * here since a seller scrolling their own city sees the card among everyone else's. */}
        {!item.isOwner && (
          <div className="mt-2">
            <button
              onClick={onContactOwner}
              className="w-full bg-green text-on-green border-none rounded-lg p-[11px] text-sm font-bold cursor-pointer"
            >
              Contact owner
            </button>
            {contactError && <p className="text-[#b3413a] text-[12px] mt-1.5">{contactError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
