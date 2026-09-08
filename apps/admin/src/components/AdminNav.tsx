"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Listings" },
  { href: "/boosts", label: "Boosts" },
  { href: "/outreach/contacts", label: "Contacts" },
  { href: "/outreach/campaigns", label: "Campaigns" },
  { href: "/logins", label: "Recent logins" },
  { href: "/users", label: "Users" },
  { href: "/page-visits", label: "Page visits" },
  { href: "/settings/rate-limits", label: "Rate limits" },
];

const SCROLL_STEP = 160;

/** `/` only matches itself — every other link matches its own path and anything nested under it
 * (e.g. `/users/[id]`, reached from the users list or the logins list, highlights "Users"). */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Persistent top nav for every authenticated admin page — rendered from the root layout so it
 * never has to be duplicated per-page. Hidden on `/login` and `/auth/*` — the only admin routes
 * reached before a session exists, the latter being the Google sign-in popup's own two pages,
 * which have no business showing a nav bar for pages the popup never visits.
 *
 * The tab strip scrolls horizontally instead of wrapping once every link no longer fits (mobile
 * widths, or just a narrow window) — the arrow buttons on either side only render when there's
 * actually more to scroll to in that direction, so every admin page stays reachable at any
 * screen size without a cluttered multi-row nav. */
export function AdminNav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    window.addEventListener("resize", updateScrollState);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;

  function scrollTabs(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: "smooth" });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "14px 24px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>Bhavano Admin</span>
        <form action={signOutAction}>
          <button
            type="submit"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 700 }}
          >
            Logout
          </button>
        </form>
      </div>

      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 12px",
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs(-1)}
            aria-label="Scroll tabs left"
            style={arrowButtonStyle}
          >
            ‹
          </button>
        )}
        <nav
          ref={scrollRef}
          onScroll={updateScrollState}
          className="admin-nav-scroll"
          style={{ display: "flex", gap: 4, overflowX: "auto", scrollBehavior: "smooth", flex: 1, minWidth: 0 }}
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  color: active ? "var(--green)" : "var(--text-soft)",
                  background: active ? "var(--surface-alt)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs(1)}
            aria-label="Scroll tabs right"
            style={arrowButtonStyle}
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

const arrowButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text-soft)",
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  lineHeight: 1,
};
