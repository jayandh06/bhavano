"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Listings" },
  { href: "/boosts", label: "Boosts" },
  { href: "/discount-codes", label: "Discount codes" },
  { href: "/outreach/contacts", label: "Contacts" },
  { href: "/outreach/campaigns", label: "Campaigns" },
  { href: "/logins", label: "Recent logins" },
  { href: "/users", label: "Users" },
  { href: "/page-visits", label: "Page visits" },
  { href: "/settings/rate-limits", label: "Rate limits" },
  { href: "/settings/contact-reveal", label: "Contact reveal" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

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

  // Close the mobile dropdown on navigation, Escape, or an outside click.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;

  function scrollTabs(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: "smooth" });
  }

  return (
    // Sticky + a soft shadow, same treatment as the web app's header — stays reachable while
    // reviewing a long scrolled-down page instead of requiring a scroll back to the top for the
    // next action. 1280 (not the old 1000) to match the dashboard table's own width, so the nav
    // no longer reads as a narrower strip floating above wider page content.
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      }}
    >
      <div
        ref={menuWrapRef}
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 24px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Mobile only (toggled by the media query in globals.css) — collapses the tab strip
            * below into a dropdown. Admin is an authed-only internal tool, so a pure client
            * toggle here carries no SEO cost. */}
          <button
            type="button"
            className="admin-nav-hamburger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-soft)",
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 2px",
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "var(--green)", letterSpacing: "-0.01em" }}>Bhavano</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Admin
            </span>
          </span>
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="admin-nav-logout"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 700,
              padding: "6px 4px",
            }}
          >
            Logout
          </button>
        </form>

        {menuOpen && (
          <div
            className="admin-nav-drawer"
            style={{
              position: "absolute",
              top: "100%",
              left: 16,
              right: 16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              zIndex: 60,
            }}
          >
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="admin-nav-link"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    padding: "10px 12px",
                    borderRadius: 8,
                    color: active ? "var(--green)" : "var(--text-soft)",
                    ...(active ? { background: "var(--surface-alt)" } : {}),
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="admin-nav-tabs-row"
        style={{
          maxWidth: 1280,
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
                className="admin-nav-link"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  color: active ? "var(--green)" : "var(--text-soft)",
                  // Left unset (not "transparent") when inactive — the stylesheet's :hover rule
                  // can only take effect when this inline style doesn't also claim `background`.
                  ...(active ? { background: "var(--surface-alt)" } : {}),
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
  border: "none",
  borderRadius: 8,
  background: "var(--green)",
  color: "var(--gold)",
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
