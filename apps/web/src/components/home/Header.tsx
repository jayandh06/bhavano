import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { City, PopularSearchDto } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import type { ParsedSegments } from "@/lib/seoRoute";
import { LocationPicker } from "./LocationPicker";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import { HeaderAuthButtons } from "./HeaderAuthButtons";
import type { HomeTabValue } from "@/lib/homeCategories";
import { CategoryTabs } from "./CategoryTabs";

export function Header({
  cityName,
  popularCities,
  searchQuery,
  activeCategory,
  userName,
  currentSegments,
  areaName,
  popularSearches,
}: {
  /** Undefined means "All cities" — the national routes (`/`, `/buy`). */
  cityName?: string;
  popularCities: City[];
  searchQuery: string;
  activeCategory: HomeTabValue;
  userName?: string | null;
  /** Passed through to `LocationPicker` — see its own prop doc. Omitted on the homepage, which
   * has no path segments to preserve across a city switch. */
  currentSegments?: ParsedSegments;
  /** A representative area name for the current city, used only to make the search bar's
   * placeholder feel dynamic (e.g. "2BHK in Koramangala, Bengaluru…"). */
  areaName?: string;
  /** Passed straight through to `SearchBar`'s "Popular searches" section — see its own prop doc. */
  popularSearches?: PopularSearchDto[];
}) {
  return (
    <>
      <div className="bg-green text-on-green text-[13px] py-1.5">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-0">
          {/* Kept visible on every screen size — this is the earliest, most reliably-crawled
           * statement of what Bhavano is on any page, so it stays on even on phones instead of
           * being dropped for the utility links' benefit. */}
          {/* Kept in the markup at every size so crawlers still read it, but truncated to one
            * line on a phone rather than wrapping to three. */}
          <span className="opacity-[0.85] truncate max-w-full">
            India&apos;s home for Buy · Rent · Villas · Plots · Coworking · PG · Commercial · Furniture
          </span>
          <div className="flex gap-5 opacity-[0.85]">
            <Link href={cityName ? `/post?city=${slugify(cityName)}` : "/post"} className="text-inherit">
              For Owners
            </Link>
            <Link href="/tools" className="text-inherit">
              Tools
            </Link>
            <Link href={cityName ? `/premium?city=${slugify(cityName)}` : "/premium"} className="text-inherit">
              Plans
            </Link>
            <Link href="/help" className="text-inherit">
              Help
            </Link>
          </div>
        </div>
      </div>

      <header className="bg-bg border-b border-border sticky top-0 z-40">
        {/* Wraps on a phone. Every child here is shrink-0 or non-wrapping by nature — logo,
          * city chip, search, account links — so a single fixed row added up to roughly twice a
          * 360px viewport and pushed the whole page into horizontal scroll. That sideways scroll
          * is what makes every other element look misaligned, since the viewport no longer
          * matches the page. Most paid traffic lands here on a phone, so this is the first thing
          * an ad click sees. */}
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-3 sm:py-[18px] flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:gap-7">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="" width={38} height={38} className="rounded-[10px] w-8 h-8 sm:w-[38px] sm:h-[38px]" priority />
            <span className="font-lora font-bold text-xl sm:text-2xl tracking-[-0.01em] text-green">Bhavano</span>
          </Link>

          <Suspense>
            <LocationPicker currentCityName={cityName} popularCities={popularCities} currentSegments={currentSegments} />
          </Suspense>
          {/* order-last + w-full drops it onto its own line on a phone, where a search box
            * squeezed between the city chip and the account links has no usable width. */}
          <Suspense>
            <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <SearchBar
              initialQuery={searchQuery}
              cityName={cityName ?? "India"}
              areaName={areaName}
              popularCities={popularCities}
              popularSearches={popularSearches}
            />
            </div>
          </Suspense>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <ThemeToggle />
          </div>
          <HeaderAuthButtons userName={userName} cityName={cityName} />
        </div>

        <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
          <Suspense>
            <CategoryTabs active={activeCategory} cityName={cityName} />
          </Suspense>
        </div>
      </header>
    </>
  );
}
