"use client";

import { useEffect, useRef } from "react";
import type { ListingCategory, TransactionType } from "@bhavano/types";

export interface SearchCriteria {
  path: string;
  q?: string;
  cityId?: string;
  areaIds?: string[];
  category?: ListingCategory;
  transactionType?: TransactionType;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number[];
  furnished?: string;
  sort?: string;
  resultCount: number;
}

/**
 * Records what a visitor searched for and how many results it returned — see `SearchEvent` in the
 * Prisma schema.
 *
 * Takes the criteria the page has *already resolved* rather than re-reading the URL, so there is
 * no second parser to keep in step with `parseSegments`/`buildQueryForSegments`, and so
 * `resultCount` — the field none of the other tables could ever reconstruct — travels with them.
 *
 * Client-side by design, not only by necessity: a crawler that does not run JavaScript never
 * reaches this, which keeps the table free of the traffic that made `PageView` 99.85% junk (see
 * docs/plans/analytics-bot-filtering-and-attribution.md). Renders nothing and holds no state
 * beyond a ref, so mounting it costs the page nothing.
 *
 * One row per distinct criteria set, deduped on a key: React can re-render and Next can re-mount
 * a client tree without the visitor having searched again, and a filter row that logged four
 * times per click would make every aggregate wrong in the same direction.
 */
export function SearchTracker({ criteria }: { criteria: SearchCriteria }) {
  const lastSent = useRef<string | null>(null);
  const key = JSON.stringify(criteria);

  useEffect(() => {
    if (lastSent.current === key) return;
    lastSent.current = key;

    void fetch("/api/analytics/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
      // So a search recorded as the visitor clicks straight through to a listing still lands.
      keepalive: true,
    }).catch(() => {
      // Best-effort. Nothing a visitor could act on, so nothing to show them.
    });
  }, [key]);

  return null;
}
