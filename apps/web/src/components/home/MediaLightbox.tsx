"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import type { MediaItem } from "./ListingMediaGallery";

/**
 * Full-screen viewer for a listing's photos and videos.
 *
 * Exists because the in-page hero is `object-cover`: it fills a fixed 320px band and crops
 * whatever does not fit, so a portrait photo of a room shows its middle third and nothing else.
 * Here the image is `object-contain` against a dark ground — the whole frame, at whatever aspect
 * ratio it was taken.
 *
 * Navigation is deliberately available three ways, because the same overlay serves a mouse, a
 * keyboard and a thumb: arrows, arrow keys, and a horizontal swipe.
 */
export function MediaLightbox({
  items,
  index,
  title,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[];
  index: number;
  title: string;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const active = items[index];
  const hasMultiple = items.length > 1;

  // Wraps rather than stopping at the ends: at full screen there is no visible track to tell you
  // you have reached the last one, so a dead arrow reads as a broken one.
  const step = useCallback(
    (delta: number) => onIndexChange((index + delta + items.length) % items.length),
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (!hasMultiple) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while this is open — on a phone a swipe meant for the
    // gallery otherwise drags the listing underneath it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [hasMultiple, onClose, step]);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — image ${index + 1} of ${items.length}`}
      // Closing on the backdrop is what people try first; the stopPropagation on the media below
      // keeps a click on the photo itself from doing it.
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        const end = e.changedTouches[0]?.clientX;
        // 50px, so a slightly untidy tap is not read as a swipe.
        if (start == null || end == null || !hasMultiple || Math.abs(end - start) < 50) return;
        step(end < start ? 1 : -1);
      }}
      className="fixed inset-0 z-[200] bg-[#0b0b0adf] flex items-center justify-center select-none"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full border-0 bg-[#ffffff1f] text-white text-xl leading-none cursor-pointer"
      >
        ✕
      </button>

      {hasMultiple && (
        <span className="absolute top-6 left-1/2 -translate-x-1/2 text-white/80 text-[13px] font-bold tabular-nums">
          {index + 1} / {items.length}
        </span>
      )}

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-2 sm:left-5 z-10 w-11 h-11 rounded-full border-0 bg-[#ffffff1f] text-white text-2xl leading-none cursor-pointer"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-2 sm:right-5 z-10 w-11 h-11 rounded-full border-0 bg-[#ffffff1f] text-white text-2xl leading-none cursor-pointer"
          >
            ›
          </button>
        </>
      )}

      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-14" onClick={(e) => e.stopPropagation()}>
        {active.kind === "photo" ? (
          <Image
            src={active.url}
            alt={`${title} — ${index + 1} of ${items.length}`}
            fill
            sizes="100vw"
            // The whole point: contain, not cover.
            className="object-contain"
          />
        ) : (
          <video
            src={active.url}
            poster={active.posterUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full"
          >
            <track kind="captions" />
          </video>
        )}
      </div>
    </div>
  );
}
