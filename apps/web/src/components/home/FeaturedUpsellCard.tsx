"use client";

import { useEffect, useRef, useState } from "react";
import { pickFeaturedUpsell, type FeaturedUpsellSettingsDto } from "@bhavano/types/featuredUpsell";
import { pushDataLayerEvent } from "@/lib/gtm";
import { readUpsellMemory, sessionFlag, setSessionFlag, writeUpsellMemory } from "@/lib/featuredUpsellMemory";
import { useBoost } from "./BoostProvider";
import { Icon } from "./Icon";
import type { UpsellListing } from "./FeaturedUpsellDialog";

const SESSION_KEY = "bhavano_featured_upsell_card";

/** The slim version for the owner's own listing page: a card at the top, never a dialog (that page is also a search page and only its owner ever sees this). Same caps and quiet
 * period as the My listings dialog, and the same per-ad memory. */
export function FeaturedUpsellCard({ settings, listing }: { settings: FeaturedUpsellSettingsDto; listing: UpsellListing }) {
  const { boost } = useBoost();
  const [visible, setVisible] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (!settings.listingCardEnabled || decided.current) return;
    decided.current = true;
    const pick = pickFeaturedUpsell({ settings, listings: [listing], memory: readUpsellMemory, shownThisSession: sessionFlag(SESSION_KEY), nowMs: Date.now() });
    if (!pick) return;
    setSessionFlag(SESSION_KEY);
    const memory = readUpsellMemory(listing.id);
    writeUpsellMemory(listing.id, { shows: memory.shows + 1, dismissedAtMs: memory.dismissedAtMs });
    setVisible(true);
    pushDataLayerEvent("featured_upsell_shown", { surface: "listing_page" });
  }, [settings, listing]);

  if (!visible) return null;

  function notNow() {
    const memory = readUpsellMemory(listing.id);
    writeUpsellMemory(listing.id, { shows: memory.shows, dismissedAtMs: Date.now() });
    pushDataLayerEvent("featured_upsell_dismissed", { surface: "listing_page" });
    setVisible(false);
  }

  function makeFeatured() {
    pushDataLayerEvent("featured_upsell_clicked", { surface: "listing_page" });
    setVisible(false);
    boost({ listingId: listing.id, category: listing.category, source: "my_listings" });
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-gold/50 bg-surface-alt/60 px-4 py-3">
        <span className="text-gold text-xl shrink-0">
          <Icon name="featured" />
        </span>
        <p className="m-0 flex-1 text-[13px] text-text-soft">
          <strong className="text-text">Want more people to see your ad?</strong> Featured ads are shown above regular ads
          {listing.viewCount > 0 ? `. Yours has ${listing.viewCount} view${listing.viewCount === 1 ? "" : "s"} so far.` : "."}
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={notNow} className="bg-transparent border border-border text-text-soft rounded-lg px-3.5 py-2 text-[13px] font-bold cursor-pointer">
            Not now
          </button>
          <button onClick={makeFeatured} className="bg-green text-on-green border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer">
            Make it Featured
          </button>
        </div>
      </div>
    </div>
  );
}
