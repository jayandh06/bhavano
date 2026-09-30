"use client";

import { useRef, useState } from "react";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { hasSessionAction } from "@/app/actions/auth";
import { useAuthGate } from "./AuthGateProvider";
import { useClickOutside } from "@/lib/useClickOutside";
import { pushDataLayerEvent } from "@/lib/gtm";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/lib/formStyles";
import { createSavedSearchAction } from "@/app/actions/saved-searches";
import { buttonClass } from "./BrowseFilterBar";
import { Icon } from "./Icon";

/** The criteria this button saves — exactly what the browse page has *already* resolved from the
 * URL (AreaFilter's current selection, BhkFilter's current buckets, BrowseFilterBar's price range)
 * rather than asking the seeker to re-enter any of it. Unlike the standalone /saved-searches page's
 * own form (a from-scratch builder for someone with no browse context yet), this only ever appears
 * once city and a price range are already set, so it never needs its own area/bedroom pickers. */
export interface SaveSearchCriteria {
  cityId?: string;
  areaIds?: string[];
  category?: ListingCategory;
  transactionType?: TransactionType;
  minPrice?: number;
  maxPrice?: number;
  bedroomOptions?: number[];
}

/**
 * "Save this search" in the browse page's own filter row — see
 * docs/plans/saved-search-multi-area-and-mandatory-fields.md. Renders nothing until the two
 * mandatory fields (city, a full price range) are set on the page, matching the create form's own
 * rule; once they are, a click prompts for a name inline (the one thing this can't infer from the
 * URL) rather than sending the seeker to the standalone page to redo the same filters by hand.
 */
export function SaveSearchButton({ criteria }: { criteria: SaveSearchCriteria }) {
  const { requireLogin } = useAuthGate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  // Same two fields the standalone form requires — see SavedSearchesManager's own validation.
  if (!criteria.cityId || criteria.minPrice === undefined || criteria.maxPrice === undefined) return null;

  async function openPrompt() {
    setError(null);
    setSaved(false);
    const signedIn = await hasSessionAction();
    if (!signedIn) {
      requireLogin({ onSuccess: () => setOpen(true) });
      return;
    }
    setOpen(true);
  }

  async function onSave() {
    if (!name.trim()) {
      setError("Give this saved search a name.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await createSavedSearchAction({ name: name.trim(), ...criteria });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    pushDataLayerEvent("save_search", { category: criteria.category, transactionType: criteria.transactionType });
    setOpen(false);
    setName("");
    setSaved(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <button className={buttonClass(open || saved)} onClick={() => (open ? setOpen(false) : void openPrompt())}>
        <Icon name="bell" className={saved ? "text-green" : undefined} /> {saved ? "Saved" : "Save this search"}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 bg-surface border border-border rounded-[10px] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 min-w-[240px] max-w-[calc(100vw-2rem)]">
          <label className="block text-[12px] font-bold text-text-soft mb-1.5">Name this search</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSave();
            }}
            placeholder="e.g. 2BHK in Koramangala"
            autoFocus
            className={fieldClass}
          />
          {error && <p className="text-[#b3413a] text-[12.5px] mt-1.5 mb-0">{error}</p>}
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => setOpen(false)} disabled={pending} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={onSave} disabled={pending} className={`ml-auto ${primaryButtonClass}`}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
