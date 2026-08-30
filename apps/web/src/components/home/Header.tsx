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
          {/* Hidden on phones, where it cost a whole line of a small screen to say something a
            * visitor who just tapped an ad does not need. Deliberately `hidden` rather than
            * removed: `display:none` still leaves it in the HTML, so it remains the earliest
            * crawlable statement of what the site is, which is the only reason it exists. */}
          <span className="hidden sm:block opacity-[0.85] truncate max-w-full">
            India&apos;s home for Buy · Rent · Villas · Plots · Coworking · PG · Commercial · Furniture
          </span>
          {/* Pushed right on a phone. The tagline that used to sit to their left is hidden
            * there, so left-aligned links ended up alone against the edge with the whole bar
            * empty beside them; against the right they line up with the account controls in the
            * row below. From sm up the tagline is back and justify-between spaces the two. */}
          <div className="flex gap-5 justify-end sm:justify-normal opacity-[0.85]">
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
        {/* Two explicit rows. The first is identity — logo and account — and the second is what
          * a visitor acts on. This started as one row that wrapped on a phone, which worked but
          * left the layout dependent on how the widths happened to add up; stating the rows means
          * desktop and phone differ only in what each row holds, not in how it is built. The
          * original single row summed to roughly twice a 360px viewport and pushed the page into
          * horizontal scroll, which is what made everything else look misaligned. */}
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
          <div className="flex items-center gap-3 py-2.5 sm:py-3">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <Image src="/logo.png" alt="" width={38} height={38} className="rounded-[10px] w-8 h-8 sm:w-[38px] sm:h-[38px]" priority />
              <span className="font-lora font-bold text-xl sm:text-2xl tracking-[-0.01em] text-green">Bhavano</span>
            </Link>
            <HeaderAuthButtons userName={userName} cityName={cityName} />
            {/* Visible at every size. It was hidden below sm while the header was one crowded
              * row and this was the least important thing competing for the space — but the row
              * is no longer crowded, and hiding it left phone users with no way to switch theme
              * at all, since nothing else offers one. */}
            <div className="flex items-center shrink-0">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 pb-2.5 sm:pb-3">
            <Suspense>
              <LocationPicker currentCityName={cityName} popularCities={popularCities} currentSegments={currentSegments} />
            </Suspense>
            {/* Desktop and tablet only. On a phone the browse-and-search job belongs to the
              * listing pages themselves, and a search box here was competing for width with the
              * two controls that matter more on arrival: which city, and post an ad. */}
            <div className="hidden sm:block flex-1 min-w-0">
              <Suspense>
                <SearchBar
                  initialQuery={searchQuery}
                  cityName={cityName ?? "India"}
                  areaName={areaName}
                  popularCities={popularCities}
                  popularSearches={popularSearches}
                />
              </Suspense>
            </div>
            {/* One element at every size now, since it sits on this row in both layouts — only
              * the label shortens. */}
            {/* Filled rather than outlined. It is the action the ad campaigns pay for and the
              * only thing on this row that is not navigation, so it should not look like the
              * city chip beside it. */}
            <Link
              href={cityName ? `/post?city=${slugify(cityName)}` : "/post"}
              className="ml-auto sm:ml-0 shrink-0 bg-green text-on-green border-0 rounded-lg px-4 sm:px-5 py-[10px] text-[13px] sm:text-sm font-bold whitespace-nowrap shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
            >
              <span className="sm:hidden">Post ad</span>
              <span className="hidden sm:inline">+ Post free ad</span>
            </Link>
          </div>
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
