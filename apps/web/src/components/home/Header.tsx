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
  accessToken,
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
  /** BFF access token from the session — forwarded to the header's Messages count badge for its
   * unread fetch + socket subscription. Undefined when logged out. */
  accessToken?: string;
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
      {/* The strip keeps its solid green, with a faint left-to-right sheen (translucent stops, so
        * it works on the mint green the dark theme swaps in too) and a hairline of the gold
        * accent under it — enough to make the one coloured band read as considered rather than a
        * flat block, at any width. */}
      <div className="bg-green bg-[linear-gradient(90deg,rgba(255,255,255,0.06),transparent_45%,rgba(0,0,0,0.07))] border-b border-gold/25 text-on-green text-[13px] py-1.5">
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
            {/* prefetch={false}: the header these pages render includes the city chip, which is
              * read from a cookie during the server render. A prefetch happens while you are
              * still on the previous page, so /tools prefetched from /bengaluru bakes "Bengaluru"
              * into a payload that the router may then serve after you have moved to the
              * all-cities home — the chip showing a city you left behind. These are low-traffic
              * utility pages; a fresh fetch on click costs nothing worth this. */}
            <Link href={cityName ? `/post?city=${slugify(cityName)}` : "/post"} prefetch={false} className="text-inherit">
              For Owners
            </Link>
            <Link href="/tools" prefetch={false} className="text-inherit">
              Tools
            </Link>
            <Link href={cityName ? `/premium?city=${slugify(cityName)}` : "/premium"} prefetch={false} className="text-inherit">
              Plans
            </Link>
            <Link href="/help" prefetch={false} className="text-inherit">
              Help
            </Link>
          </div>
        </div>
      </div>

      {/* Lifted off the page instead of sharing its cream and being cut off by a 1px line.
        *
        * Solid `surface` (crisp white in light, the raised panel colour in dark) at every size,
        * plus a shadow that widens and softens from sm up — no backdrop blur (it janked a tall
        * sticky bar scrolling over an image-heavy list on low-end Android, and was hard to tell
        * apart from plain flatness at a glance anyway).
        *
        * sm and up only get the decorative wash below: a soft gold gradient anchored at the
        * horizontal centre of the screen and fading out toward both edges, with a low-opacity
        * skyline silhouette underneath it for texture. Skipped on phones, where the header is
        * narrow enough that the effect would just read as noise behind the logo. */}
      <header className="relative overflow-hidden bg-surface shadow-[0_1px_0_rgba(0,0,0,0.05),0_6px_16px_-8px_rgba(11,61,46,0.18)] sm:shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(11,61,46,0.16)] sticky top-0 z-40">
        <div aria-hidden className="hidden sm:block absolute inset-0 pointer-events-none">
          {/* Brand-toned line art, not a photo — there is no existing header/hero image asset in
            * the repo to reuse, and a skyline silhouette reads as "property" without competing
            * with real listing photos elsewhere on the page. `preserveAspectRatio="none"` lets it
            * stretch to whatever width the header actually is rather than cropping. */}
          <svg
            className="absolute inset-0 h-full w-full text-green opacity-[0.05]"
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <rect x="0" y="66" width="48" height="34" />
            <rect x="48" y="48" width="36" height="52" />
            <rect x="64" y="34" width="4" height="14" />
            <rect x="90" y="72" width="54" height="28" />
            <rect x="150" y="56" width="40" height="44" />
            <rect x="196" y="40" width="60" height="60" />
            <rect x="262" y="78" width="34" height="22" />
            <rect x="302" y="62" width="48" height="38" />
            <rect x="356" y="50" width="56" height="50" />
            <rect x="418" y="80" width="30" height="20" />
            <rect x="454" y="54" width="44" height="46" />
            <rect x="474" y="42" width="4" height="12" />
            <rect x="504" y="68" width="60" height="32" />
            <rect x="570" y="46" width="40" height="54" />
            <rect x="616" y="74" width="50" height="26" />
            <rect x="672" y="58" width="36" height="42" />
            <rect x="720" y="66" width="48" height="34" />
            <rect x="768" y="48" width="36" height="52" />
            <rect x="784" y="34" width="4" height="14" />
            <rect x="810" y="72" width="54" height="28" />
            <rect x="870" y="56" width="40" height="44" />
            <rect x="916" y="40" width="60" height="60" />
            <rect x="982" y="78" width="34" height="22" />
            <rect x="1022" y="62" width="48" height="38" />
            <rect x="1076" y="50" width="56" height="50" />
            <rect x="1138" y="80" width="30" height="20" />
            <rect x="1174" y="54" width="44" height="46" />
            <rect x="1194" y="42" width="4" height="12" />
            <rect x="1224" y="68" width="60" height="32" />
            <rect x="1290" y="46" width="40" height="54" />
            <rect x="1336" y="74" width="50" height="26" />
            <rect x="1392" y="58" width="36" height="42" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
        </div>

        {/* Two explicit rows. The first is identity — logo and account — and the second is what
          * a visitor acts on. This started as one row that wrapped on a phone, which worked but
          * left the layout dependent on how the widths happened to add up; stating the rows means
          * desktop and phone differ only in what each row holds, not in how it is built. The
          * original single row summed to roughly twice a 360px viewport and pushed the page into
          * horizontal scroll, which is what made everything else look misaligned. */}
        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-8">
          <div className="flex items-center gap-3 py-2.5 sm:py-3">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <Image src="/logo.png" alt="" width={38} height={38} className="rounded-[10px] w-8 h-8 sm:w-[38px] sm:h-[38px]" priority />
              <span className="font-lora font-bold text-xl sm:text-2xl tracking-[-0.01em] text-green">Bhavano</span>
            </Link>
            <HeaderAuthButtons userName={userName} cityName={cityName} accessToken={accessToken} />
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

        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-8">
          <Suspense>
            <CategoryTabs active={activeCategory} cityName={cityName} />
          </Suspense>
        </div>
      </header>
    </>
  );
}
