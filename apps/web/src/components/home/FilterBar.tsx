"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildHomeUrl } from "@/lib/homeUrl";

const BEDROOM_OPTIONS = [1, 2, 3, 4];
const FURNISHING_OPTIONS: { value: string; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
];

type OpenFilter = "price" | "bedrooms" | "furnishing" | null;

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
  padding: 14,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  zIndex: 50,
  minWidth: 220,
};

export function FilterBar({
  resultsCount,
  cityName,
  activeMinPrice,
  activeMaxPrice,
  activeBedrooms,
  activeFurnished,
}: {
  resultsCount: number;
  cityName: string;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  activeBedrooms?: number;
  activeFurnished?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<OpenFilter>(null);
  const [minPriceInput, setMinPriceInput] = useState(activeMinPrice?.toString() ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(activeMaxPrice?.toString() ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function applyPrice() {
    const min = minPriceInput ? Number(minPriceInput) : undefined;
    const max = maxPriceInput ? Number(maxPriceInput) : undefined;
    router.push(
      buildHomeUrl(searchParams, {
        minPrice: min !== undefined && !Number.isNaN(min) ? String(min) : undefined,
        maxPrice: max !== undefined && !Number.isNaN(max) ? String(max) : undefined,
      }),
    );
    setOpen(null);
  }

  function selectBedrooms(value: number | undefined) {
    router.push(buildHomeUrl(searchParams, { bedrooms: value !== undefined ? String(value) : undefined }));
    setOpen(null);
  }

  function selectFurnished(value: string | undefined) {
    router.push(buildHomeUrl(searchParams, { furnished: value }));
    setOpen(null);
  }

  const priceLabel =
    activeMinPrice !== undefined || activeMaxPrice !== undefined
      ? `Price: ${activeMinPrice ?? "0"}–${activeMaxPrice ?? "any"}`
      : "Price";
  const bedroomsLabel = activeBedrooms !== undefined ? `${activeBedrooms}+ Beds` : "Bedrooms";
  const furnishingLabel = FURNISHING_OPTIONS.find((f) => f.value === activeFurnished)?.label ?? "Furnishing";

  return (
    <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <div
        ref={containerRef}
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        <div style={{ position: "relative" }}>
          <button style={buttonStyle(open === "price" || priceLabel !== "Price")} onClick={() => setOpen(open === "price" ? null : "price")}>
            {priceLabel} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
          </button>
          {open === "price" && (
            <div style={dropdownStyle}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Min price
                  <input
                    type="number"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </label>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Max price
                  <input
                    type="number"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </label>
                <button
                  onClick={applyPrice}
                  style={{ marginTop: 4, background: "var(--green)", color: "var(--on-green)", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: "pointer" }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button style={buttonStyle(open === "bedrooms" || activeBedrooms !== undefined)} onClick={() => setOpen(open === "bedrooms" ? null : "bedrooms")}>
            {bedroomsLabel} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
          </button>
          {open === "bedrooms" && (
            <div style={dropdownStyle}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <DropdownOption label="Any" active={activeBedrooms === undefined} onClick={() => selectBedrooms(undefined)} />
                {BEDROOM_OPTIONS.map((n) => (
                  <DropdownOption key={n} label={`${n}+ Beds`} active={activeBedrooms === n} onClick={() => selectBedrooms(n)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button style={buttonStyle(open === "furnishing" || activeFurnished !== undefined)} onClick={() => setOpen(open === "furnishing" ? null : "furnishing")}>
            {furnishingLabel} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
          </button>
          {open === "furnishing" && (
            <div style={dropdownStyle}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <DropdownOption label="Any" active={activeFurnished === undefined} onClick={() => selectFurnished(undefined)} />
                {FURNISHING_OPTIONS.map((f) => (
                  <DropdownOption key={f.value} label={f.label} active={activeFurnished === f.value} onClick={() => selectFurnished(f.value)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          {resultsCount} results near {cityName}
        </div>
      </div>
    </div>
  );
}

function DropdownOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
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
