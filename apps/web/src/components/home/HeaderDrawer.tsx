import { Suspense } from "react";
import Link from "next/link";
import type { City } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import type { ParsedSegments } from "@/lib/seoRoute";
import { segmentsForHomeCategory } from "@/lib/seoRoute";
import { buildBrowsePath } from "@/lib/listingPath";
import { HOME_TABS, type HomeTabValue } from "@/lib/homeCategories";
import { LocationPicker } from "./LocationPicker";
import { HeaderDrawerAccount } from "./HeaderDrawerAccount";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./Icon";

/**
 * Contents of the mobile header's hamburger drawer (see `MobileHeaderCollapse`). Plain Server
 * Component — every destination is a real `<Link>` in the server HTML, not a client-only list,
 * so nothing here is hidden from a crawler. It reuses the same interactive leaves the full
 * header uses (`LocationPicker`, `HeaderAuthButtons`, `ThemeToggle`) rather than reimplementing
 * them, and derives the category links from the same `HOME_TABS` vocabulary `CategoryTabs` does.
 */

const rowBase = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors";
const rowClass = `${rowBase} text-text-soft hover:bg-surface-alt hover:text-text`;
/** The category the current page is showing — a filled row with a gold leading rule, the drawer
 * equivalent of the highlighted tab in `CategoryTabs`. */
const rowActiveClass = `${rowBase} text-green bg-surface-alt border-l-[3px] border-gold pl-[9px]`;

export function HeaderDrawer({
  cityName,
  popularCities,
  currentSegments,
  activeCategory,
  userName,
}: {
  cityName?: string;
  popularCities: City[];
  currentSegments?: ParsedSegments;
  activeCategory?: HomeTabValue;
  userName?: string | null;
}) {
  return (
    <>
      <div className="px-1 pb-1">
        <Suspense>
          <LocationPicker currentCityName={cityName} popularCities={popularCities} currentSegments={currentSegments} />
        </Suspense>
      </div>

      {/* Logged out: the sign-in CTA sits here, next to the city control and styled like Post ad
        * — not a plain row buried under the nav where you'd have to go looking for it. Once
        * signed in it moves to the account list at the bottom instead. */}
      {!userName && (
        <div className="px-1 py-1.5">
          <HeaderDrawerAccount userName={userName} cityName={cityName} />
        </div>
      )}

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Browse</span>
        <ThemeToggle />
      </div>
      {HOME_TABS.map((tab) => {
        const isActive = tab.value === activeCategory;
        return (
          <Link
            key={tab.value}
            href={buildBrowsePath({ cityName, ...segmentsForHomeCategory(tab.value) })}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? rowActiveClass : rowClass}
          >
            <Icon name={tab.icon} className={isActive ? "text-green" : "text-muted"} />
            {tab.label}
          </Link>
        );
      })}
      <Link href="/tools" prefetch={false} className={rowClass}>
        <Icon name="calculator" className="text-muted" /> Tools
      </Link>
      <Link href={cityName ? `/premium?city=${slugify(cityName)}` : "/premium"} prefetch={false} className={rowClass}>
        <Icon name="sparkles" className="text-gold" /> Plans
      </Link>

      <div className="my-1.5 border-t border-border" />

      <Link href={cityName ? `/post?city=${slugify(cityName)}` : "/post"} prefetch={false} className={rowClass}>
        <Icon name="list" className="text-muted" /> For Owners
      </Link>
      <Link href="/help" prefetch={false} className={rowClass}>
        <Icon name="help" className="text-muted" /> Help
      </Link>

      {userName && (
        <>
          <div className="my-1.5 border-t border-border" />
          <HeaderDrawerAccount userName={userName} cityName={cityName} />
        </>
      )}
    </>
  );
}
