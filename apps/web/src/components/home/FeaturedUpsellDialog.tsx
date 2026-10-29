"use client";

import { useEffect, useRef, useState } from "react";
import type { ListingCategory } from "@bhavano/types";
import { featuredBenefits } from "@bhavano/types/featuredBenefits";
import { pickFeaturedUpsell, type FeaturedUpsellSettingsDto } from "@bhavano/types/featuredUpsell";
import { pushDataLayerEvent } from "@/lib/gtm";
import { reportPostAction } from "@/lib/postActionTrail";
import { readUpsellMemory, sessionFlag, setSessionFlag, writeUpsellMemory } from "@/lib/featuredUpsellMemory";
import { useBoost } from "./BoostProvider";
import { Icon } from "./Icon";

export interface UpsellListing {
  id: string;
  category: ListingCategory;
  title: string;
  status: string;
  publishState?: string | null;
  isBoosted: boolean;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  interestCount?: number;
}

const SESSION_KEY = "bhavano_featured_upsell_dialog";
const SHOW_DELAY_MS = 1500;

/** "Make your ad Featured" on My listings. Once per browser session, for the owner's newest live ad that is not Featured, never within `minAgeHours` of posting, quiet for
 * `quietDays` after "Not now" and never more than `maxShowsPerAd` times for one ad. It states only the ad's own numbers and the true Featured benefits. Admin switch,
 * off by default: Admin -> Settings -> Featured prompt (docs/plans/featured-upsell-prompt.md). */
export function FeaturedUpsellDialog({ settings, listings, leadContactOn = false }: { settings: FeaturedUpsellSettingsDto; listings: UpsellListing[]; leadContactOn?: boolean }) {
  const { boost } = useBoost();
  const [active, setActive] = useState<UpsellListing | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    if (!settings.enabled || decided.current) return;
    decided.current = true;
    const pick = pickFeaturedUpsell({ settings, listings, memory: readUpsellMemory, shownThisSession: sessionFlag(SESSION_KEY), nowMs: Date.now() });
    if (!pick) return;
    const timer = window.setTimeout(() => {
      setSessionFlag(SESSION_KEY);
      const memory = readUpsellMemory(pick.id);
      writeUpsellMemory(pick.id, { shows: memory.shows + 1, dismissedAtMs: memory.dismissedAtMs });
      setActive(pick);
      pushDataLayerEvent("featured_upsell_shown", { surface: "my_listings" });
      reportPostAction("upsell", "shown", { surface: "my_listings" });
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [settings, listings]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && notNow();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  function notNow() {
    if (!active) return;
    const memory = readUpsellMemory(active.id);
    writeUpsellMemory(active.id, { shows: memory.shows, dismissedAtMs: Date.now() });
    pushDataLayerEvent("featured_upsell_dismissed", { surface: "my_listings" });
    reportPostAction("upsell", "dismissed", { surface: "my_listings" });
    setActive(null);
  }

  function makeFeatured() {
    if (!active) return;
    const listing = active;
    pushDataLayerEvent("featured_upsell_clicked", { surface: "my_listings" });
    reportPostAction("upsell", "clicked", { surface: "my_listings" });
    setActive(null);
    boost({ listingId: listing.id, category: listing.category, source: "my_listings" });
  }

  const stats = [
    active.viewCount > 0 ? `${active.viewCount} view${active.viewCount === 1 ? "" : "s"}` : null,
    (active.interestCount ?? 0) > 0 ? `${active.interestCount} interested` : null,
    active.likeCount > 0 ? `${active.likeCount} save${active.likeCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div onClick={notNow} className="fixed inset-0 bg-[var(--modal-scrim)] z-[100] flex items-center justify-center p-5" role="dialog" aria-label="Make your ad Featured">
      <div onClick={(e) => e.stopPropagation()} className="bg-surface rounded-2xl w-[420px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]">
        <div className="flex justify-between items-start gap-3 mb-1">
          <div className="font-lora font-bold text-[19px] text-text">Get more people to see your ad</div>
          <button onClick={notNow} aria-label="Close" className="bg-transparent border-0 text-xl cursor-pointer text-muted shrink-0">
            <Icon name="close" />
          </button>
        </div>
        <p className="text-[13px] text-muted m-0 mb-3 truncate">{active.title}</p>
        {stats.length > 0 && (
          <p className="text-[13px] text-text-soft m-0 mb-3">
            So far: <strong className="text-text">{stats.join(", ")}</strong>. Featured ads are shown above regular ads.
          </p>
        )}
        <ul className="list-none m-0 mb-4 p-0 flex flex-col gap-1.5">
          {featuredBenefits(leadContactOn).slice(0, 5).map((benefit) => (
            <li key={benefit} className="flex gap-2 text-[13px] text-text-soft">
              <span className="text-green shrink-0">
                <Icon name="check" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
        <button onClick={makeFeatured} className="w-full bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer">
          Make it Featured
        </button>
        <button onClick={notNow} className="w-full bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer mt-2">
          Not now
        </button>
      </div>
    </div>
  );
}
