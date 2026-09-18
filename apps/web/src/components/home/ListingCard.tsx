"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { useRouter } from "next/navigation";
import { useAuthGate } from "./AuthGateProvider";
import { useBuyCredits } from "./BuyCreditsProvider";
import { toggleFavouriteAction, revealContactAction } from "@/app/actions/listings";
import { hasSessionAction } from "@/app/actions/auth";
import { buildListingPath } from "@/lib/listingPath";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";
import { ShareButton } from "./ShareButton";

export function ListingCard({ item }: { item: ListingCardDto }) {
  const { requireLogin } = useAuthGate();
  const { buyCredits } = useBuyCredits();
  const router = useRouter();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [contactError, setContactError] = useState<string | null>(null);
  const href = buildListingPath(item);

  const [contactRevealed, setContactRevealed] = useState(item.contactRevealed);
  const [ownerPhone, setOwnerPhone] = useState(item.ownerPhone);
  const [ownerEmail, setOwnerEmail] = useState(item.ownerEmail);
  const [revealPending, setRevealPending] = useState(false);

  // A small, cheap benefit of being Featured, not a full swipeable carousel: cycling through
  // every photo would mean loading N images per boosted card up front, on a page that can show a
  // couple dozen cards at once — real risk to LCP on browse pages, which are this site's
  // SEO-critical routes. Hovering is the one interaction that's already "I'm actually looking at
  // this card" without costing anything for cards nobody hovers — one extra image request at a
  // time, only while genuinely being looked at. `(hover: hover)` (same idiom CategoryTabs.tsx
  // already uses) keeps this off touch devices entirely: a tap-triggered synthetic hover there
  // would fire the cycle right before navigating away, for no benefit and a wasted request.
  const [hoverPhotoIndex, setHoverPhotoIndex] = useState(0);
  const hoverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canCyclePhotos = item.isBoosted && item.photos.length > 1;

  useEffect(() => {
    return () => {
      if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    };
  }, []);

  function startPhotoCycle() {
    if (!canCyclePhotos) return;
    if (typeof window === "undefined" || !window.matchMedia("(hover: hover)").matches) return;
    hoverIntervalRef.current = setInterval(() => {
      setHoverPhotoIndex((i) => (i + 1) % item.photos.length);
    }, 1200);
  }

  function stopPhotoCycle() {
    if (hoverIntervalRef.current) {
      clearInterval(hoverIntervalRef.current);
      hoverIntervalRef.current = null;
    }
    setHoverPhotoIndex(0);
  }

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

  // Whether login is needed is the server's answer, not a guess from client state: an expired
  // session cookie still looks "logged in" to the client, so this asks the server via
  // hasSessionAction rather than trusting anything held here. `onSuccess` resumes the same call
  // once login completes, so the user isn't left having to tap the button a second time.
  async function onMessage(e: React.MouseEvent) {
    e.preventDefault();
    const signedIn = await hasSessionAction();
    if (!signedIn) {
      requireLogin({ onSuccess: () => void onMessage(e) });
      return;
    }
    pushDataLayerEvent("contact_owner", { listingId: item.id });
    router.push(`/messages/new/${item.id}`);
  }

  async function onViewContact(e?: React.MouseEvent) {
    e?.preventDefault();
    setRevealPending(true);
    setContactError(null);
    const result = await revealContactAction(item.id);
    setRevealPending(false);

    if (result.requiresLogin) {
      requireLogin({ onSuccess: () => void onViewContact() });
      return;
    }
    if (result.insufficientCredits) {
      buyCredits({
        listingId: item.id,
        creditPackSize: item.creditPackSize,
        creditPackPriceRupees: item.creditPackPriceRupees,
        // The webhook grants the credit batch, not the checkout callback — wait a beat, then
        // retry the reveal, which should now succeed.
        onPurchased: () => setTimeout(() => void onViewContact(), 4000),
      });
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
        onMouseEnter={startPhotoCycle}
        onMouseLeave={stopPhotoCycle}
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
          <Image
            src={item.photos[hoverPhotoIndex] ?? item.photos[0]}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
        )}
        {/* The resting hint that hovering does something, and mobile/no-hover's only signal that
          * more photos exist at all, since it never gets the cycle above. Static — a dot-per-photo
          * indicator that tracked hoverPhotoIndex would be reaching back toward carousel
          * territory for a benefit nobody but a hovering desktop visitor could even see change. */}
        {canCyclePhotos && (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-[#00000099] text-white text-[11px] font-bold px-2 py-1 rounded-md pointer-events-none">
            <Icon name="camera" /> {item.photos.length}
          </span>
        )}
        {/* TEMP(auth-gate): viewing listing details is open without login for now. */}
        {/* prefetch={false} — the whole card is one link repeated twice (photo + body), and a
          * results grid puts a dozen or more of these in the viewport at once. Next would
          * prefetch every one, and a listing page is fully dynamic: every BFF fetch in this app
          * is cache: "no-store", so each prefetch is a real server render plus real Postgres
          * queries for a page nobody opened. Cheap to give up here specifically, since these
          * open in a new tab (target="_blank"), which Next's router doesn't handle anyway — the
          * prefetched payload can't be used to make the navigation instant. Same reasoning
          * recorded in 9119370 for refusing Chrome's prefetch proxy outright. */}
        <Link href={href} prefetch={false} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center">
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
        {/* Share sits here rather than in the bottom action row so it's visible on your own
          * listing too, unlike Message/Contact below — a seller sharing their own ad is a real
          * use case those two aren't. Same fixed near-white circle as the favourite button, for
          * the same reason: this overlay sits on a photo, not a themed surface, so its icon color
          * has to be fixed too or it vanishes into the circle in dark mode. */}
        <div className="absolute top-2.5 right-2.5 flex gap-2 z-[1]">
          <ShareButton
            path={href}
            title={item.title}
            listingId={item.id}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#ffffffee] border-none cursor-pointer text-[15px] text-[#3a3a3a]"
          />
          <button
            onClick={onToggleFavourite}
            className={`w-8 h-8 rounded-full bg-[#ffffffee] border-none cursor-pointer text-[15px] ${
              isFavourited ? "text-[#c0554b]" : "text-[#3a3a3a]"
            }`}
          >
            <Icon name="heart" filled={isFavourited} />
          </button>
        </div>
      </div>

      <div className="p-[18px] flex flex-col gap-2.5 flex-1">
        {/* TEMP(auth-gate): viewing listing details is open without login for now. */}
        {/* prefetch={false}: see the note on the photo link above — same href, same reasoning. */}
        <Link href={href} prefetch={false} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2.5 text-inherit">
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
    </div>
  );
}
