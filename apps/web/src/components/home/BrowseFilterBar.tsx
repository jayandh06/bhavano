"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { PRICE_BOUNDS } from "@bhavano/types/priceBounds";
import { useClickOutside } from "@/lib/useClickOutside";

const FURNISHING_OPTIONS: { value: string; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
];

interface PriceBracket {
  label: string;
  minPrice?: number;
  maxPrice?: number;
}

function formatINR(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${n}`;
}

/** Quick-pick price brackets sized off this category's own plausibility bounds
 * (packages/types/src/priceBounds.ts) — a PG's brackets land in the thousands, a house's in
 * lakhs/crores, without hand-tuning either separately. */
function priceBracketsFor(category: ListingCategory, isSale: boolean): PriceBracket[] {
  const bounds = PRICE_BOUNDS[category][isSale ? "sale" : "rental"];
  const low = Math.min(bounds.min * 20, bounds.max);
  const high = Math.min(bounds.min * 200, bounds.max);
  return [
    { label: `Under ${formatINR(low)}`, maxPrice: low },
    { label: `${formatINR(low)} – ${formatINR(high)}`, minPrice: low, maxPrice: high },
    { label: `${formatINR(high)}+`, minPrice: high },
  ];
}

type OpenFilter = "price" | "furnished" | null;

const buttonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "var(--surface-alt)" : "var(--bg)",
  border: `1px solid ${active ? "var(--green)" : "var(--border)"}`,
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: active ? "var(--green)" : "var(--text-soft)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
});

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  zIndex: 50,
  minWidth: 200,
};

/** Category-aware refinement layer for a browse results page — narrows via query params on
 * top of the clean canonical path (e.g. ?minPrice=..&furnished=..), never changing the path
 * itself. `furnished` only renders for house/apartment; price brackets are sized per category. */
export function BrowseFilterBar({
  category,
  isSale,
  activeMinPrice,
  activeMaxPrice,
  activeFurnished,
}: {
  category?: ListingCategory;
  isSale: boolean;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  activeFurnished?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<OpenFilter>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(null));

  if (!category) return null;

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(null);
  }

  function selectBracket(bracket: PriceBracket) {
    navigate({
      minPrice: bracket.minPrice !== undefined ? String(bracket.minPrice) : undefined,
      maxPrice: bracket.maxPrice !== undefined ? String(bracket.maxPrice) : undefined,
    });
  }

  const brackets = priceBracketsFor(category, isSale);
  const priceLabel =
    activeMinPrice !== undefined || activeMaxPrice !== undefined
      ? brackets.find((b) => b.minPrice === activeMinPrice && b.maxPrice === activeMaxPrice)?.label ?? "Price"
      : "Price";
  const furnishingLabel = FURNISHING_OPTIONS.find((f) => f.value === activeFurnished)?.label ?? "Furnishing";
  const showFurnished = category === "house" || category === "apartment";

  return (
    <div ref={containerRef} style={{ display: "flex", gap: 10, marginBottom: 20, position: "relative" }}>
      <div style={{ position: "relative" }}>
        <button style={buttonStyle(open === "price" || priceLabel !== "Price")} onClick={() => setOpen(open === "price" ? null : "price")}>
          {priceLabel} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
        </button>
        {open === "price" && (
          <div style={dropdownStyle}>
            <DropdownOption label="Any" active={activeMinPrice === undefined && activeMaxPrice === undefined} onClick={() => selectBracket({ label: "Any" })} />
            {brackets.map((b) => (
              <DropdownOption key={b.label} label={b.label} active={priceLabel === b.label} onClick={() => selectBracket(b)} />
            ))}
          </div>
        )}
      </div>

      {showFurnished && (
        <div style={{ position: "relative" }}>
          <button style={buttonStyle(open === "furnished" || activeFurnished !== undefined)} onClick={() => setOpen(open === "furnished" ? null : "furnished")}>
            {furnishingLabel} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
          </button>
          {open === "furnished" && (
            <div style={dropdownStyle}>
              <DropdownOption label="Any" active={activeFurnished === undefined} onClick={() => navigate({ furnished: undefined })} />
              {FURNISHING_OPTIONS.map((f) => (
                <DropdownOption key={f.value} label={f.label} active={activeFurnished === f.value} onClick={() => navigate({ furnished: f.value })} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: active ? "var(--surface-alt)" : "transparent",
        color: active ? "var(--green)" : "var(--text)",
        border: "none",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
