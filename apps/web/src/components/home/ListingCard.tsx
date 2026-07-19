"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction } from "@/app/actions/listings";
import { buildListingPath } from "@/lib/listingPath";

export function ListingCard({ item, cityName }: { item: ListingCardDto; cityName: string }) {
  const { requireLogin } = useAuthGate();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
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
        <span className="absolute top-3 left-3 bg-green text-on-green text-[11px] font-bold px-2.5 py-1 rounded-md pointer-events-none">
          {item.tag}
        </span>
        <button
          onClick={onToggleFavourite}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-[#ffffffee] border-none cursor-pointer text-[15px] z-[1] ${
            isFavourited ? "text-[#c0554b]" : ""
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
        <div className="flex gap-2.5 mt-2">
          <button
            onClick={requireLogin}
            className="flex-1 bg-green text-on-green border-none rounded-lg p-[11px] text-sm font-bold cursor-pointer"
          >
            Contact owner
          </button>
          <button
            onClick={requireLogin}
            className="bg-surface text-green border-[1.5px] border-green rounded-lg px-4 py-[11px] text-sm font-bold cursor-pointer"
          >
            Call
          </button>
        </div>
      </div>
    </div>
  );
}
