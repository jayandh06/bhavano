"use client";

import { useState } from "react";
import Link from "next/link";
import type { HomeTab } from "@/lib/homeCategories";
import { hrefForLink } from "@/lib/homeCategories";

export function MegaMenu({
  tab,
  cityName,
  onNavigate,
}: {
  tab: HomeTab;
  /** Undefined for national browsing. Links then omit the city segment, and their labels read
   * "in India" — the label and the path need the value for different reasons, which is why one
   * falls back to a word and the other stays undefined. */
  cityName?: string;
  onNavigate: () => void;
}) {
  const [activeValue, setActiveValue] = useState(tab.column1[0]?.value);
  const activeItem = tab.column1.find((item) => item.value === activeValue) ?? tab.column1[0];
  const links = activeItem ? activeItem.links(cityName ?? "India") : [];
  // Only House/Apartment/Villa (BHK breakdown) and Furniture's conditions (Buy vs Rent) have a
  // second column worth showing — everything else's label is already the one and only link
  // (see singleLinkColumn1Item), so column 2 would just repeat it.
  const hasColumn2 = links.length > 0;
  const itemLinkClassName = (isActive: boolean) =>
    `block w-full text-left border-0 rounded-md px-3 py-2.5 text-[13.5px] font-bold cursor-pointer no-underline ${
      isActive ? "bg-surface-alt text-green" : "bg-transparent text-text"
    }`;

  return (
    // Positioning (absolute/top/left) is applied by the caller, which places this under
    // whichever tab is open — no gap between this and the tab row above it, since CategoryTabs
    // opens/closes this on hover and any gap becomes a dead zone where the pointer briefly hovers
    // neither element, firing mouseleave and slamming the menu shut before the user can reach it.
    <div
      className={`z-50 flex bg-surface border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] w-[min(480px,calc(100vw-2rem))] sm:w-auto max-h-[360px] ${hasColumn2 ? "sm:min-w-[480px]" : "sm:min-w-[220px]"}`}
    >
      <div
        className={`shrink-0 overflow-y-auto p-1.5 ${hasColumn2 ? "w-[42%] sm:w-[200px] border-r border-border" : "w-full"}`}
      >
        {tab.column1.map((item) => {
          const itemHref = item.href?.(cityName);
          return itemHref ? (
            <Link
              key={item.value}
              href={itemHref}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setActiveValue(item.value)}
              onClick={onNavigate}
              className={itemLinkClassName(activeValue === item.value)}
            >
              {item.label}
            </Link>
          ) : (
            <button
              key={item.value}
              type="button"
              onMouseEnter={() => setActiveValue(item.value)}
              onClick={() => setActiveValue(item.value)}
              className={itemLinkClassName(activeValue === item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {hasColumn2 && (
        <div className="flex-1 overflow-y-auto p-1.5 sm:min-w-[260px]">
          {links.map((link) => (
            <Link
              key={link.label}
              href={hrefForLink(link, cityName)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className="block px-3 py-2.5 text-[13.5px] text-text-soft no-underline rounded-md transition-colors hover:bg-surface-alt hover:text-green focus-visible:bg-surface-alt focus-visible:text-green focus-visible:outline-none"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
