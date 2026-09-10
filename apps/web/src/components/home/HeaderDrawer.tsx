import { Suspense } from "react";
import Link from "next/link";
import type { City } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import type { ParsedSegments } from "@/lib/seoRoute";
import { segmentsForHomeCategory } from "@/lib/seoRoute";
import { buildBrowsePath } from "@/lib/listingPath";
import { HOME_TABS } from "@/lib/homeCategories";
import { LocationPicker } from "./LocationPicker";
import { HeaderAuthButtons } from "./HeaderAuthButtons";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./Icon";

/**
 * Contents of the mobile header's hamburger drawer (see `MobileHeaderCollapse`). Plain Server
 * Component — every destination is a real `<Link>` in the server HTML, not a client-only list,
 * so nothing here is hidden from a crawler. It reuses the same interactive leaves the full
 * header uses (`LocationPicker`, `HeaderAuthButtons`, `ThemeToggle`) rather than reimplementing
 * them, and derives the category links from the same `HOME_TABS` vocabulary `CategoryTabs` does.
 */

const rowClass =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-text-soft hover:bg-surface-alt hover:text-text transition-colors";

export function HeaderDrawer({
  cityName,
  popularCities,
  currentSegments,
  userName,
  accessToken,
}: {
  cityName?: string;
  popularCities: City[];
  currentSegments?: ParsedSegments;
  userName?: string | null;
  accessToken?: string;
}) {
  return (
    <>
      <div className="px-1 pb-1">
        <Suspense>
          <LocationPicker currentCityName={cityName} popularCities={popularCities} currentSegments={currentSegments} />
        </Suspense>
      </div>

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Browse</span>
        <ThemeToggle />
      </div>
      {HOME_TABS.map((tab) => (
        <Link key={tab.value} href={buildBrowsePath({ cityName, ...segmentsForHomeCategory(tab.value) })} className={rowClass}>
          <Icon name={tab.icon} className="text-muted" />
          {tab.label}
        </Link>
      ))}
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

      <div className="my-1.5 border-t border-border" />

      <div className="px-1 pb-1">
        <HeaderAuthButtons userName={userName} cityName={cityName} accessToken={accessToken} />
      </div>
    </>
  );
}
