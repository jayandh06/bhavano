"use client";

import { useEffect, useState } from "react";
import type { City } from "@bhavano/types";
import { searchCitiesAction } from "@/app/actions/locations";

export type PickedCity = Pick<City, "id" | "name">;

/**
 * "Which city?" for a requirement — the capture card on an India-wide page, and the refinement
 * questions for a row saved before a city was required. Popular cities as one-tap chips, and a
 * search for the rest (the same `/locations/cities` lookup as the header's city picker).
 */
export function RequirementCityPicker({
  value,
  onChange,
  disabled,
}: {
  value?: PickedCity;
  onChange: (city: PickedCity) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<City[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    const timer = setTimeout(
      () => {
        void searchCitiesAction(q)
          .then((list) => {
            if (!cancelled) setCities(list);
          })
          .catch(() => {
            if (!cancelled) setCities([]);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const shown = [
    ...(value && !cities?.some((c) => c.id === value.id) ? [value] : []),
    ...(cities ?? []),
  ];

  return (
    <div className="flex flex-col gap-2.5 w-full text-left">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for your city"
        aria-label="Search for your city"
        disabled={disabled}
        className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-[13.5px] bg-surface text-text outline-none focus:border-green"
      />
      {cities === null ? (
        <p className="m-0 text-[12.5px] text-muted">Loading cities…</p>
      ) : shown.length === 0 ? (
        <p className="m-0 text-[12.5px] text-muted">No city by that name.</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {shown.map((city) => {
            const active = value?.id === city.id;
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => onChange({ id: city.id, name: city.name })}
                disabled={disabled}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-1.5 pointer-coarse:min-h-11 pointer-coarse:px-3.5 text-[13px] cursor-pointer disabled:opacity-60 ${
                  active ? "border-green bg-surface-alt text-text font-bold" : "border-border bg-surface text-text"
                }`}
              >
                {city.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
