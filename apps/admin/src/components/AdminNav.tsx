"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";

const NAV_GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Moderation",
    links: [
      { href: "/", label: "Listings" },
      { href: "/requirements", label: "Requirements" },
      { href: "/notification-log", label: "Notification log" },
      { href: "/area-overviews", label: "Area overviews" },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/users", label: "Users" },
      { href: "/logins", label: "Recent logins" },
      { href: "/referrals", label: "Referrals" },
    ],
  },
  {
    label: "Analytics",
    links: [
      { href: "/page-visits", label: "Page visits" },
      { href: "/post-funnel", label: "Post funnel" },
      { href: "/listing-performance", label: "Listing performance" },
      { href: "/search-demand", label: "Search demand" },
    ],
  },
  {
    label: "Outreach",
    links: [
      { href: "/outreach/contacts", label: "Contacts" },
      { href: "/outreach/campaigns", label: "Campaigns" },
    ],
  },
  {
    label: "Billing & promotions",
    links: [
      { href: "/subscriptions", label: "Subscriptions" },
      { href: "/discount-codes", label: "Discount codes" },
    ],
  },
  {
    label: "Settings",
    links: [
      { href: "/settings/plans", label: "Plans" },
      { href: "/settings/rate-limits", label: "Rate limits" },
      { href: "/settings/contact-reveal", label: "Contact reveal" },
      { href: "/settings/referrals", label: "Referral rewards" },
      { href: "/settings/alerts", label: "Search alerts" },
      { href: "/settings/login-nudge", label: "Login prompt" },
    ],
  },
];

/** Every menu item is a plain `<a>` — a full page load — not a `<Link>`, deliberately. A bare-path
 * navigation (`/`, `/logins`, ...) is what middleware.ts answers with a redirect to the remembered
 * filter, and when that redirect answers a *client-side* navigation, Next's router lands on the
 * filtered page but is then left unable to act on the next <Link> click there: a date-range
 * preset, a tab or a sort header flashes its pending state and snaps back without sending any
 * request (reproduced by entering Listings from another admin page with a saved filter; a real
 * page load was never affected, and neither was pressing Apply, which is one). A document request
 * takes the same redirect and lands in a healthy state. It also means there is no background
 * prefetch of these hrefs to worry about, which used to wipe the just-applied filter (the phantom
 * request looked like a real click to middleware.ts). See docs/plans/admin-remembered-filters.md. */

/** `/` only matches itself — every other link matches its own path and anything nested under it
 * (e.g. `/users/[id]`, reached from the users list or the logins list, highlights "Users"). */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Persistent top nav for every authenticated admin page — rendered from the root layout so it
 * never has to be duplicated per-page. Hidden on `/login` and `/auth/*` — the only admin routes
 * reached before a session exists, the latter being the Google sign-in popup's own two pages,
 * which have no business showing a nav bar for pages the popup never visits. */
export function AdminNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  // Close the menu on Escape or an outside click. Navigation uses full page loads, so the
  // component unmounts after choosing a menu item.
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

  return (
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
        className="admin-nav-inner"
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          className="admin-nav-menu-button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="admin-navigation-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1 }}>
            {menuOpen ? "✕" : "☰"}
          </span>
          <span>Menu</span>
        </button>
        <span style={{ display: "flex", alignItems: "baseline", gap: 7, marginRight: "auto" }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: "var(--green)", letterSpacing: "-0.01em" }}>Bhavano</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Admin
          </span>
        </span>
        <form action={signOutAction}>
          <button type="submit" className="admin-nav-logout">Logout</button>
        </form>

        {menuOpen && (
          <nav
            id="admin-navigation-menu"
            className="admin-nav-menu"
            aria-label="Admin pages"
          >
            {NAV_GROUPS.map((group) => (
              <section key={group.label} className="admin-nav-group">
                <h2>{group.label}</h2>
                <div>
                  {group.links.map((link) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        className="admin-nav-link"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
