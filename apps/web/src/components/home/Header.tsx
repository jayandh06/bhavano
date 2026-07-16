import type { City, HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
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
  activePropertyType,
  userName,
}: {
  cityName: string;
  popularCities: City[];
  searchQuery: string;
  activeCategory: HomeCategoryFilter;
  activePropertyType?: PropertyTypeFilter;
  userName?: string | null;
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
            <span>For Owners</span>
            <span>Help</span>
          </div>
        </div>
      </div>

      <header style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 32px", display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: "2.5px solid var(--gold)",
                  borderBottom: "none",
                  borderRadius: "3px 3px 0 0",
                  transform: "rotate(45deg) translate(1px,-1px)",
                }}
              />
            </div>
            <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", color: "var(--green)" }}>
              Bhavano
            </span>
          </div>

          <LocationPicker currentCityName={cityName} popularCities={popularCities} />
          <SearchBar initialQuery={searchQuery} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <ThemeToggle />
          </div>
          <HeaderAuthButtons userName={userName} />
        </div>

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
          <CategoryTabs active={activeCategory} activePropertyType={activePropertyType} />
        </div>
      </header>
    </>
  );
}
