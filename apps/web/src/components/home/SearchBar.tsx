"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { City, ListingCategory, PopularSearchDto } from "@bhavano/types";
import { buildHomeUrl } from "@/lib/homeUrl";
import { buildBrowsePath } from "@/lib/listingPath";
import { parseSearchQuery } from "@/lib/parseSearchQuery";
import {
  CATEGORY_LABELS,
  TRANSACTION_LABELS,
  bedroomLabel,
  categoryGroupsFor,
  facetKindForCategory,
  formatINR,
  transactionGroupFor,
  type TransactionGroup,
} from "@/lib/seoRoute";
import { useClickOutside } from "@/lib/useClickOutside";

function removeCaseInsensitive(haystack: string, needle: string): string {
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return haystack;
  return (haystack.slice(0, idx) + haystack.slice(idx + needle.length)).replace(/\s+/g, " ").trim();
}

interface Interpretation {
  targetCityName: string;
  areaCandidate: string;
  category?: ListingCategory;
  transactionGroup?: TransactionGroup;
  facetValue?: number;
  minPrice?: number;
  maxPrice?: number;
  somethingRecognized: boolean;
}

/** Shared by both `submit()` (build the destination URL) and the live "interpreted as…" preview
 * — both need the exact same reading of the query text, just rendered two different ways. */
function interpret(text: string, cityName: string, popularCities: City[]): Interpretation {
  const intent = parseSearchQuery(text);
  const matchedCity = popularCities.find((c) => intent.residual.toLowerCase().includes(c.name.toLowerCase()));
  const targetCityName = matchedCity?.name ?? cityName;
  const areaCandidate = matchedCity ? removeCaseInsensitive(intent.residual, matchedCity.name) : intent.residual;

  const category = intent.category ?? (intent.bedrooms !== undefined ? "apartment" : undefined);
  const transactionGroup = intent.transactionGroup ?? (category ? categoryGroupsFor(category)[0] : undefined);
  const facetValue = category && facetKindForCategory(category) === "bedrooms" ? intent.bedrooms : undefined;

  const somethingRecognized = Boolean(
    category || transactionGroup || matchedCity || intent.minPrice !== undefined || intent.maxPrice !== undefined || areaCandidate,
  );

  return {
    targetCityName,
    areaCandidate,
    category,
    transactionGroup,
    facetValue,
    minPrice: intent.minPrice,
    maxPrice: intent.maxPrice,
    somethingRecognized,
  };
}

/** Human-readable tokens for the live preview — e.g. "2 BHK Apartments · Rent & Lease · under
 * ₹5,000 · in Koramangala, Bengaluru". Best-effort: `areaCandidate` hasn't been checked against
 * the DB (that only happens once the destination page resolves `?area=`), so it's shown as a
 * plain locality guess, not a confirmed match. */
function describe(result: Interpretation): string[] {
  const tokens: string[] = [];
  if (result.facetValue !== undefined) tokens.push(`${bedroomLabel(result.facetValue)} BHK`);
  if (result.category) tokens.push(CATEGORY_LABELS[result.category]);
  if (result.transactionGroup) tokens.push(result.transactionGroup === "buy" ? "Buy" : "Rent & Lease");
  if (result.minPrice !== undefined) tokens.push(`above ${formatINR(result.minPrice)}`);
  if (result.maxPrice !== undefined) tokens.push(`under ${formatINR(result.maxPrice)}`);
  const place = result.areaCandidate ? `${result.areaCandidate}, ${result.targetCityName}` : result.targetCityName;
  tokens.push(`in ${place}`);
  return tokens;
}

export function SearchBar({
  initialQuery,
  cityName,
  areaName,
  popularCities,
  popularSearches,
}: {
  initialQuery: string;
  /** The city currently being browsed — used as the search target when no other city is named
   * in the query text (e.g. "furniture under 5000" while already on a Bengaluru page). */
  cityName: string;
  /** A representative locality for `cityName`, used both for the placeholder and the example
   * chips in the search help dialog. */
  areaName?: string;
  popularCities: City[];
  /** This city's top (category, transactionType) combinations by view count — shown as a real,
   * directly-navigable "Popular searches" section in the same help dialog, above the free-text
   * "Try searching" examples. Omitted (e.g. the listing-detail page) means that section just
   * doesn't render. */
  popularSearches?: PopularSearchDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  function go(text: string) {
    const result = interpret(text, cityName, popularCities);

    if (!result.somethingRecognized) {
      // Rule-based parsing didn't find a city/category/price/area in this — fall back to the
      // plain title-text search the homepage already supports, rather than a dead end.
      router.push(buildHomeUrl(searchParams, { q: text }));
      return;
    }

    const path = buildBrowsePath({
      cityName: result.targetCityName,
      transactionGroup: result.transactionGroup,
      category: result.category,
      facetValue: result.facetValue,
    });
    const qs = new URLSearchParams();
    if (result.minPrice !== undefined) qs.set("minPrice", String(result.minPrice));
    if (result.maxPrice !== undefined) qs.set("maxPrice", String(result.maxPrice));
    // Best-effort — the destination page silently ignores this if it doesn't match a real
    // locality, so a wrong guess here never 404s the whole search.
    if (result.areaCandidate) qs.set("area", result.areaCandidate);
    const query = qs.toString();
    router.push(query ? `${path}?${query}` : path);
  }

  function submit() {
    const text = value.trim();
    if (!text) return;
    setOpen(false);
    go(text);
  }

  function submitChip(text: string) {
    setValue(text);
    setOpen(false);
    go(text);
  }

  const placeholder = areaName
    ? `Search "2BHK in ${areaName}, ${cityName}", "furniture under 5000"…`
    : `Search "2BHK in ${cityName}", "PG near IT park", "sofa set"…`;

  const place = areaName ?? cityName;
  const exampleChips = [
    `2 BHK in ${place}`,
    `Furniture under ₹5,000 in ${cityName}`,
    `PG in ${cityName}`,
    `Coworking in ${cityName}`,
  ];

  const trimmedValue = value.trim();
  const preview = open && trimmedValue ? describe(interpret(trimmedValue, cityName, popularCities)) : null;

  return (
    <div ref={containerRef} className="flex-1 relative min-w-0">
      <div className="flex items-center bg-surface border border-border rounded-[10px] pl-3.5 pr-1.5">
        <span className="text-muted text-[15px]">🔍</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="flex-1 border-0 outline-none px-2.5 py-3 text-sm bg-transparent min-w-0 text-text"
        />
        <button
          onClick={submit}
          className="bg-green text-on-green border-0 rounded-[7px] px-[18px] py-[9px] text-sm font-bold cursor-pointer"
        >
          Search
        </button>
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-surface border border-border rounded-[10px] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50">
          {preview ? (
            <>
              <div className="text-[11px] font-bold text-muted mb-2">SEARCHING FOR</div>
              <div className="text-sm font-semibold text-green">→ {preview.join(" · ")}</div>
            </>
          ) : (
            <>
              {popularSearches && popularSearches.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-bold text-muted mb-2">POPULAR SEARCHES</div>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((s) => (
                      <Link
                        key={`${s.cityName}-${s.category}-${s.transactionType}`}
                        href={buildBrowsePath({ cityName: s.cityName, transactionGroup: transactionGroupFor(s.transactionType), category: s.category })}
                        onClick={() => setOpen(false)}
                        className="bg-surface-alt border border-border rounded-[20px] px-3.5 py-[7px] text-[13px] text-text no-underline"
                      >
                        {CATEGORY_LABELS[s.category]} {TRANSACTION_LABELS[s.transactionType]} in {s.cityName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[11px] font-bold text-muted mb-2">TRY SEARCHING</div>
              <div className="flex flex-wrap gap-2">
                {exampleChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => submitChip(chip)}
                    className="bg-surface-alt border border-border rounded-[20px] px-3.5 py-[7px] text-[13px] text-text cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
