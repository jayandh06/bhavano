"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import type { ListingVideoDto } from "@bhavano/types";
import { MediaLightbox } from "./MediaLightbox";

export type MediaItem =
  | { kind: "photo"; url: string }
  | { kind: "video"; url: string; posterUrl: string; durationSec: number };

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** The listing-detail hero + thumbnail strip, extracted from ListingDetailView (still a server
 * component) so this piece alone can hold click-to-select state — the thumbnail strip was
 * previously fully inert. Photos come first (existing order), videos (only ever `status: "done"`
 * — ListingsService.toDetailDto already filters this for non-owner/non-admin viewers) appended
 * after. Index 0 defaults to the first photo and is still a `priority` `next/image`: this
 * component is a Client Component, but Next.js still server-renders it for the initial HTML, so
 * the LCP element (this listing-detail page is the highest-traffic, most SEO-load-bearing surface
 * in the product) is unaffected by the "use client" boundary — a <video> is never the default/
 * initial-paint element regardless of selection state. */
export function ListingMediaGallery({
  photosFull,
  videos,
  title,
  tag,
  isExpired,
  imgColors,
  imgLabel,
  children,
}: {
  photosFull: string[];
  videos: ListingVideoDto[];
  title: string;
  tag: string;
  isExpired: boolean;
  imgColors: [string, string];
  imgLabel: string;
  /** Rendered between the hero and the thumbnail strip — the page passes its price, title and
   * location block here. The strip belongs under those rather than pinned to the hero, and the
   * two cannot be separated in the tree because they share the selected index. */
  children?: ReactNode;
}) {
  const items: MediaItem[] = [
    ...photosFull.map((url): MediaItem => ({ kind: "photo", url })),
    ...videos.map((v): MediaItem => ({ kind: "video", url: v.url, posterUrl: v.posterUrl, durationSec: v.durationSec })),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const active = items[activeIndex];

  return (
    <>
      <div
        className={`relative h-[320px] rounded-2xl overflow-hidden flex items-center justify-center ${
          items.length > 1 ? "mb-2.5" : "mb-6"
        }`}
        style={
          active
            ? undefined
            : { background: `repeating-linear-gradient(135deg, ${imgColors[0]}, ${imgColors[0]} 14px, ${imgColors[1]} 14px, ${imgColors[1]} 28px)` }
        }
      >
        {active?.kind === "photo" && (
          // A button, not a bare image: the hero is cropped to a fixed band, so tapping it to
          // see the whole frame is the obvious thing to try and previously did nothing.
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="View full size"
            className="absolute inset-0 border-0 p-0 bg-transparent cursor-zoom-in"
          >
            <Image src={active.url} alt={title} fill priority={activeIndex === 0} sizes="(max-width: 880px) 100vw, 880px" className="object-cover" />
          </button>
        )}
        {active?.kind === "video" && (
          // preload="none", no autoplay: this page pays per-view for what it loads, and a
          // hero video that auto-fetches on every crawl/bounce would be a real bandwidth cost.
          <video src={active.url} poster={active.posterUrl} controls preload="none" playsInline className="w-full h-full object-cover">
            <track kind="captions" />
          </video>
        )}
        {!active && (
          <span className="font-mono text-[13px] text-[#ffffffcc] bg-[#00000030] px-3 py-1.5 rounded-md">{imgLabel}</span>
        )}
        <span className="absolute top-4 left-4 bg-green text-on-green text-xs font-bold px-3 py-[5px] rounded-md">{tag}</span>
        {isExpired && (
          <span className="absolute top-4 right-4 bg-[#242420] text-[#F5F1E6] text-xs font-bold px-3 py-[5px] rounded-md">Expired</span>
        )}
      </div>

      {children}

      {items.length > 1 && (
        <div className="flex gap-2.5 mb-6 overflow-x-auto scrollbar-none">
          {items.map((item, i) => (
            <button
              key={item.kind === "photo" ? item.url : item.url + item.posterUrl}
              type="button"
              onClick={() => {
                // Selecting and opening in one tap. The strip now sits below the title, far
                // enough from the hero that "select, then look up" is a poor trade.
                setActiveIndex(i);
                setLightboxOpen(true);
              }}
              className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-0 p-0 cursor-pointer ${
                i === activeIndex ? "outline outline-2 outline-green" : ""
              }`}
            >
              <Image
                src={item.kind === "photo" ? item.url : item.posterUrl}
                alt={`${title} ${item.kind} ${i + 1}`}
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
              {item.kind === "video" && (
                <>
                  <span className="absolute inset-0 flex items-center justify-center bg-[#00000033] text-white text-lg">▶</span>
                  <span className="absolute bottom-1 right-1 bg-[#000000aa] text-white text-[10px] font-bold px-1 rounded">
                    {formatDuration(item.durationSec)}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <MediaLightbox
          items={items}
          index={activeIndex}
          title={title}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setActiveIndex}
        />
      )}
    </>
  );
}
