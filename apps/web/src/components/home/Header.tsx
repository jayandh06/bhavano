import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { City, HomeCategoryFilter, PopularSearchDto } from "@bhavano/types";
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
  popularSearches,
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
  /** Passed straight through to `SearchBar`'s "Popular searches" section — see its own prop doc. */
  popularSearches?: PopularSearchDto[];
}) {
  return (
    <>
      <div className="bg-green text-on-green text-[13px] py-1.5">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex justify-between items-center">
          {/* Long tagline is decorative — hidden on phones so the utility links keep their room. */}
          <span className="hidden sm:inline opacity-[0.85]">India&apos;s home for Buy · Rent · Coworking · PG · Furniture</span>
          <div className="flex gap-5 opacity-[0.85]">
            <Link href="/post" className="text-inherit">
              For Owners
            </Link>
            <Link href="/help" className="text-inherit">
              Help
            </Link>
          </div>
        </div>
      </div>

      <header className="bg-bg border-b border-border sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-[18px] flex items-center gap-3 sm:gap-7">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="" width={38} height={38} className="rounded-[10px]" priority />
            <span className="font-lora font-bold text-2xl tracking-[-0.01em] text-green">Bhavano</span>
          </Link>

          <Suspense>
            <LocationPicker currentCityName={cityName} popularCities={popularCities} currentSegments={currentSegments} />
          </Suspense>
          <Suspense>
            <SearchBar
              initialQuery={searchQuery}
              cityName={cityName}
              areaName={areaName}
              popularCities={popularCities}
              popularSearches={popularSearches}
            />
          </Suspense>

          <div className="flex items-center gap-3 shrink-0">
            <ThemeToggle />
          </div>
          <HeaderAuthButtons userName={userName} />
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
