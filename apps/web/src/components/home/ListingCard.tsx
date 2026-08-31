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
import { Icon } from "./Icon";

export function ListingCard({ item }: { item: ListingCardDto }) {
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
    // sm:hover rather than plain hover: below that breakpoint is where touch-primary devices
    // live, and :hover there does not mean "the pointer is over this" the way it does with a
    // mouse — it means "this was the last thing tapped," which reads as the card staying stuck
    // highlighted rather than as an effect at all. Same shadow token the dropdown menus already
    // use, not a new one, so an elevated card matches what "elevated" already looks like
    // elsewhere in the app. Border and shadow only, no scale/translate: the grid's columns sit
    // close together, and a card that grows or shifts on hover jostles its neighbours' edges.
    <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col animate-[fadein_0.4s_ease_both] transition-[box-shadow,border-color] duration-200 sm:hover:border-green/40 sm:hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
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
          <div className="flex gap-3 text-[11.5px] text-muted">
            <span className="flex items-center gap-1"><Icon name="eye" /> {item.viewCount}</span>
            <span className="flex items-center gap-1"><Icon name="heart" /> {likeCount}</span>
          </div>
        </Link>
        {/* Hidden on your own listing — the same reason as on the detail page, and more visible
          * here since a seller scrolling their own city sees the card among everyone else's. */}
        {!item.isOwner && (
          <div className="mt-2">
            {/* Heavier than a default button on purpose — this is the one action a listing
              * exists to produce, so it should read as the obvious next step in a glance rather
              * than tie visually with Favourite beside it. The shadow matches the header's own
              * "Post ad" CTA (see Header.tsx) rather than inventing a second treatment; the
              * brightness hover/active is filter-based so it needs no new colour token and still
              * respects the theme. */}
            <button
              onClick={onContactOwner}
              className="w-full flex items-center justify-center gap-1.5 bg-green text-on-green border-none rounded-lg p-3 text-sm font-extrabold tracking-[0.01em] cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-[filter] hover:brightness-110 active:brightness-95"
            >
              <Icon name="message" />
              Contact owner
            </button>
            {contactError && <p className="text-[#b3413a] text-[12px] mt-1.5">{contactError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
