"use client";

import Link from "next/link";
import { pushDataLayerEvent } from "@/lib/gtm";
import { AD_LANDING_INTENTS, adLandingPostHref, type AdLandingIntentKey } from "@/lib/adLandingCard";
import { Icon } from "./Icon";

/** Anchor the "Browse listings" link scrolls to — rendered by the homepage just above its grid. */
export const LISTINGS_ANCHOR_ID = "listings";

/**
 * Clicks are written as synthetic page views (`/ad-card/post`, `/ad-card/browse`), the same hop
 * StepTracker uses for `/post/preview`, so admin Page visits shows which way each paid visitor
 * went. Mounting writes nothing: an extra page view per landing would turn every bounce into a
 * two-page session. A preview (`?adcard=`) records nothing at all.
 */
function recordClick(action: "post" | "browse", intent: AdLandingIntentKey, preview: boolean) {
  if (preview) return;
  pushDataLayerEvent("ad_card_click", { action, intent });
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/ad-card/${action}?intent=${intent}` }),
    keepalive: true,
  }).catch(() => {
    // Best-effort, same as StepTracker.
  });
}

export function AdLandingCard({
  intent,
  preview,
  freeToPost,
}: {
  intent: AdLandingIntentKey;
  preview: boolean;
  /** False when the admin has a platform fee on for this card's category — "free" is then left
   * unsaid rather than promised and contradicted at checkout. */
  freeToPost: boolean;
}) {
  const card = AD_LANDING_INTENTS[intent];

  return (
    <section
      aria-label="Post your property"
      className="mb-6 rounded-2xl border border-border bg-surface-alt p-4 sm:p-5 sm:flex sm:items-center sm:gap-8"
    >
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-gold">For property owners</p>
        <h2 className="font-lora text-[20px] sm:text-[22px] leading-snug font-semibold m-0 mt-1 text-text">
          {card.headline}
        </h2>
        <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-1.5 text-[13px] text-text-soft">
          <li className="flex items-center gap-2">
            <Icon name="message" /> No brokerage — buyers and tenants message you directly
          </li>
          <li className="flex items-center gap-2">
            <Icon name="camera" /> Add photos and videos straight from your phone
          </li>
          {freeToPost && (
            <li className="flex items-center gap-2">
              <Icon name="check" /> Free to post
            </li>
          )}
        </ul>
      </div>
      <div className="mt-4 sm:mt-0 sm:w-[240px] shrink-0 flex flex-col items-stretch gap-2.5">
        <Link
          href={adLandingPostHref(intent)}
          onClick={() => recordClick("post", intent, preview)}
          className="bg-green text-on-green rounded-lg px-5 py-3 text-[15px] font-bold text-center shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
        >
          {card.button}
        </Link>
        <a
          href={`#${LISTINGS_ANCHOR_ID}`}
          onClick={() => recordClick("browse", intent, preview)}
          className="text-center text-[13px] text-muted hover:underline"
        >
          Looking to buy or rent? Browse listings ↓
        </a>
      </div>
    </section>
  );
}
