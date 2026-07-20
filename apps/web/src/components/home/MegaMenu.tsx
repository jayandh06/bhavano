"use client";

import { useState } from "react";
import Link from "next/link";
import type { HomeTab } from "@/lib/homeCategories";
import { hrefForLink } from "@/lib/homeCategories";

export function MegaMenu({ tab, cityName, onNavigate }: { tab: HomeTab; cityName: string; onNavigate: () => void }) {
  const [activeValue, setActiveValue] = useState(tab.column1[0]?.value);
  const activeItem = tab.column1.find((item) => item.value === activeValue) ?? tab.column1[0];
  const links = activeItem ? activeItem.links(cityName) : [];

  return (
    // Positioning (absolute/top/left) is applied by the caller, which places this under
    // whichever tab is open — no gap between this and the tab row above it, since CategoryTabs
    // opens/closes this on hover and any gap becomes a dead zone where the pointer briefly hovers
    // neither element, firing mouseleave and slamming the menu shut before the user can reach it.
    <div className="z-50 flex bg-surface border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] min-w-[480px] max-h-[360px]">
      <div className="w-[200px] border-r border-border overflow-y-auto p-1.5">
        {tab.column1.map((item) => (
          <button
            key={item.value}
            type="button"
            onMouseEnter={() => setActiveValue(item.value)}
            onClick={() => setActiveValue(item.value)}
            className={`block w-full text-left border-0 rounded-md px-3 py-2.5 text-[13.5px] font-bold cursor-pointer ${
              activeValue === item.value ? "bg-surface-alt text-green" : "bg-transparent text-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 min-w-[260px]">
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
    </div>
  );
}
