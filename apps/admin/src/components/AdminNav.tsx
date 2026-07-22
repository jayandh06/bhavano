"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Listings" },
  { href: "/boosts", label: "Boosts" },
  { href: "/logins", label: "Recent logins" },
  { href: "/settings/rate-limits", label: "Rate limits" },
];

/** `/` only matches itself — every other link matches its own path and anything nested under
 * it (e.g. `/users/[id]`, reached only via the logins list, still highlights "Recent logins"). */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Persistent top nav for every authenticated admin page — rendered from the root layout so it
 * never has to be duplicated per-page. Hidden on `/login`, the only admin route reached before
 * a session exists. */
export function AdminNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Bhavano Admin</span>
          <nav style={{ display: "flex", gap: 4 }}>
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
                    color: active ? "var(--green)" : "var(--text-soft)",
                    background: active ? "var(--surface-alt)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 700 }}
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
