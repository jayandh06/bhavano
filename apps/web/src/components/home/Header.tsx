import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { City, HomeCategoryFilter } from "@bhavano/types";
import type { ParsedSegments } from "@/lib/seoRoute";
import { LocationPicker } from "./LocationPicker";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import { HeaderAuthButtons } from "./HeaderAuthButtons";
import { CategoryTabs } from "./CategoryTabs";

export function Header({
  cityName,
  popularCities,
  searchQuery,
  activeCategory,
  userName,
  currentSegments,
  areaName,
}: {
  cityName: string;
  popularCities: City[];
  searchQuery: string;
  activeCategory: HomeCategoryFilter;
  userName?: string | null;
  /** Passed through to `LocationPicker` — see its own prop doc. Omitted on the homepage, which
   * has no path segments to preserve across a city switch. */
  currentSegments?: ParsedSegments;
  /** A representative area name for the current city, used only to make the search bar's
   * placeholder feel dynamic (e.g. "2BHK in Koramangala, Bengaluru…"). */
  areaName?: string;
}) {
  return (
    <>
      <div style={{ background: "var(--green)", color: "var(--on-green)", fontSize: 13, padding: "6px 0" }}>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ opacity: 0.85 }}>India&apos;s home for Buy · Rent · Coworking · PG · Furniture</span>
          <div style={{ display: "flex", gap: 20, opacity: 0.85 }}>
            <Link href="/post" style={{ color: "inherit" }}>
              For Owners
            </Link>
            <Link href="/help" style={{ color: "inherit" }}>
              Help
            </Link>
          </div>
        </div>
      </div>

      <header style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 32px", display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Image src="/logo.png" alt="" width={38} height={38} style={{ borderRadius: 10 }} priority />
            <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", color: "var(--green)" }}>
              Bhavano
            </span>
          </Link>

          <Suspense>
            <LocationPicker currentCityName={cityName} popularCities={popularCities} currentSegments={currentSegments} />
          </Suspense>
          <Suspense>
            <SearchBar initialQuery={searchQuery} cityName={cityName} areaName={areaName} popularCities={popularCities} />
          </Suspense>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <ThemeToggle />
          </div>
          <HeaderAuthButtons userName={userName} />
        </div>

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
          <Suspense>
            <CategoryTabs active={activeCategory} cityName={cityName} />
          </Suspense>
        </div>
      </header>
    </>
  );
}
