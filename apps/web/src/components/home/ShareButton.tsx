"use client";

import { useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";

/**
 * One share control, not a share button plus a separate email button. `navigator.share` already
 * puts Mail/Gmail alongside WhatsApp, Messages, etc. in the OS's own share sheet on every browser
 * that supports it (iOS Safari, Chrome/Samsung Internet on Android, recent desktop Chrome/Edge) —
 * a second "Email" button next to it would just be one of that sheet's own entries pulled out and
 * duplicated. Only where there's no OS sheet to supply it (desktop Firefox, older browsers) does
 * this falls back to a small menu — and that's the one place email gets an explicit entry of its
 * own, alongside copy-link and WhatsApp.
 */
export function ShareButton({
  path,
  title,
  listingId,
  className,
}: {
  /** Relative path, e.g. `buildListingPath(item)` — resolved against `window.location.origin` at
   * share time rather than passed in absolute, since this renders during SSR where no origin
   * exists yet. */
  path: string;
  title: string;
  listingId: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  function absoluteUrl(): string {
    return typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  }

  async function onShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    pushDataLayerEvent("share_listing", { listingId });
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: absoluteUrl() });
      } catch {
        // AbortError on cancel, or any other failure — either way the OS's own share sheet
        // already closed itself, nothing left here to recover.
      }
      return;
    }
    setOpen((o) => !o);
  }

  async function onCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(absoluteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const url = absoluteUrl();
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;

  return (
    <div ref={containerRef} className="relative">
      <button onClick={onShare} aria-label="Share this listing" className={className}>
        <Icon name="share" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[calc(100%+6px)] right-0 bg-surface border border-border rounded-[10px] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[170px] max-w-[calc(100vw-2rem)] flex flex-col gap-0.5"
        >
          <button
            onClick={onCopyLink}
            className="flex items-center gap-2 w-full text-left bg-transparent border-0 cursor-pointer rounded-md px-2.5 py-2 text-[13px] text-text"
          >
            <Icon name="copy" className={copied ? "text-green" : "text-muted"} /> {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 w-full text-left rounded-md px-2.5 py-2 text-[13px] text-text no-underline"
          >
            <Icon name="message" className="text-muted" /> WhatsApp
          </a>
          <a
            href={emailHref}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 w-full text-left rounded-md px-2.5 py-2 text-[13px] text-text no-underline"
          >
            <Icon name="mail" className="text-muted" /> Email
          </a>
        </div>
      )}
    </div>
  );
}
