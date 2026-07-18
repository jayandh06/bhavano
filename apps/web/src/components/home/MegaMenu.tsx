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
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 50,
        display: "flex",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        marginTop: 4,
        minWidth: 480,
        maxHeight: 360,
      }}
    >
      <div style={{ width: 200, borderRight: "1px solid var(--border)", overflowY: "auto", padding: 6 }}>
        {tab.column1.map((item) => (
          <button
            key={item.value}
            type="button"
            onMouseEnter={() => setActiveValue(item.value)}
            onClick={() => setActiveValue(item.value)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: activeValue === item.value ? "var(--surface-alt)" : "transparent",
              color: activeValue === item.value ? "var(--green)" : "var(--text)",
              border: "none",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 6, minWidth: 260 }}>
        {links.map((link) => (
          <Link
            key={link.label}
            href={hrefForLink(link, cityName)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            style={{
              display: "block",
              padding: "10px 12px",
              fontSize: 13.5,
              color: "var(--text-soft)",
              textDecoration: "none",
              borderRadius: 6,
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
