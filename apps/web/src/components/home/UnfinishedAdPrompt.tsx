"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { POST_CATEGORIES } from "@bhavano/types/postCategories";
import { peekPostAdDraft } from "@/lib/postAdDraft";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";

const DISMISSED_KEY = "bhavano:finish-ad-dismissed";
const SHOWN_KEY = "bhavano:finish-ad-shown";
const TRANSACTION_WORD: Partial<Record<TransactionType, string>> = { sell: "sale", rent: "rent", lease: "lease" };

/** Pages where the prompt would be noise: the form itself (it offers the draft), and listing pages, which already have a
 * bottom-pinned login card. */
function hiddenOn(pathname: string): boolean {
  return pathname.startsWith("/post") || pathname.startsWith("/listings/") || pathname.startsWith("/claim");
}

function describe(category: ListingCategory, transactionType: TransactionType | null): string {
  const label = POST_CATEGORIES.find((c) => c.value === category)?.label ?? "property";
  const word = transactionType ? TRANSACTION_WORD[transactionType] : undefined;
  return word ? `${label} for ${word}` : label;
}

/** Same synthetic-pageview trick as the post-ad wizard's events, so admin's Page visits shows when this was seen and used. */
function record(event: "shown" | "clicked" | "dismissed") {
  pushDataLayerEvent("finish_ad_prompt", { event });
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/post/finish-prompt?event=${event}` }),
    keepalive: true,
  }).catch(() => {
    // Best-effort.
  });
}

/**
 * "You have an unfinished ad" on every page (not only /post) while a post-ad draft is saved in this browser, so a seller who left the
 * form and is browsing finds the way back. A floating card, not a bar, so it never moves the page (no layout shift) and is never part
 * of the server-rendered HTML. Dismissing hides it for that draft only: an edit to the draft brings it back. See
 * docs/plans/recover-sellers-who-leave-without-posting.md, item 3c.
 */
export function UnfinishedAdPrompt() {
  const pathname = usePathname();
  const [draft, setDraft] = useState<ReturnType<typeof peekPostAdDraft>>(null);

  useEffect(() => {
    // Browser storage only exists after mount. Read in a microtask, like the other storage-driven prompts here
    // (ProfileCompletionDialog), so no state is set synchronously in the effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (hiddenOn(pathname)) {
        setDraft(null);
        return;
      }
      const found = peekPostAdDraft();
      let dismissedFor: string | null = null;
      try {
        dismissedFor = localStorage.getItem(DISMISSED_KEY);
      } catch {
        // Storage unavailable: show it.
      }
      const next = found && dismissedFor !== String(found.savedAt) ? found : null;
      setDraft(next);
      if (!next) return;
      try {
        if (sessionStorage.getItem(SHOWN_KEY) !== String(next.savedAt)) {
          sessionStorage.setItem(SHOWN_KEY, String(next.savedAt));
          record("shown");
        }
      } catch {
        // Storage unavailable: skip the event rather than record it on every page.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!draft) return;
    document.documentElement.dataset.unfinishedAd = "1";
    return () => {
      delete document.documentElement.dataset.unfinishedAd;
    };
  }, [draft]);

  if (!draft) return null;

  function dismiss() {
    if (!draft) return;
    try {
      localStorage.setItem(DISMISSED_KEY, String(draft.savedAt));
    } catch {
      // Storage unavailable: it just comes back on the next page.
    }
    record("dismissed");
    setDraft(null);
  }

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-[calc(1rem+var(--app-strip-h,0px))] z-40 w-[calc(100%-24px)] max-w-[440px] bg-surface border border-border rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.14)] text-[13px] text-text pl-4 pr-2 py-2.5 flex items-center gap-3"
    >
      <Icon name="edit" className="text-green shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="font-bold">You have an unfinished ad</span>
        <span className="block text-text-soft truncate">{describe(draft.category, draft.transactionType)}, saved on this device</span>
      </span>
      <Link
        href="/post"
        onClick={() => record("clicked")}
        className="bg-green text-on-green rounded-lg px-3 py-2 text-[12.5px] font-bold no-underline whitespace-nowrap"
      >
        Finish it
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide"
        className="bg-transparent border-0 text-muted cursor-pointer p-1.5 leading-none"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
