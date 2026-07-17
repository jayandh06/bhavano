"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAuthGate } from "./AuthGateProvider";
import { signOutAction } from "@/app/actions/auth";
import { useClickOutside } from "@/lib/useClickOutside";

export function HeaderAuthButtons({ userName }: { userName?: string | null }) {
  const { requireLogin } = useAuthGate();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      {/* TEMP(auth-gate): posting is open without login for now. */}
      <Link
        href="/post"
        style={{
          background: "none",
          border: "1.5px solid var(--green)",
          color: "var(--green)",
          borderRadius: 8,
          padding: "9px 16px",
          fontSize: 14,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        + Post free ad
      </Link>
      <Link href="/favourites" style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
        ♡ Favourites
      </Link>
      <Link href="/messages" style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
        💬 Messages
      </Link>
      {userName ? (
        <AccountMenu userName={userName} />
      ) : (
        <button
          onClick={requireLogin}
          style={{
            background: "none",
            border: "none",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Login
        </button>
      )}
    </div>
  );
}

function AccountMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--text)",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {userName} <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
            minWidth: 160,
            overflow: "hidden",
          }}
        >
          <Link href="/profile" onClick={() => setOpen(false)} style={menuItemStyle}>
            Profile
          </Link>
          <Link href="/my-listings" onClick={() => setOpen(false)} style={menuItemStyle}>
            My listings
          </Link>
          <Link href="/help" onClick={() => setOpen(false)} style={menuItemStyle}>
            Help
          </Link>
          <button onClick={() => signOutAction()} style={{ ...menuItemStyle, width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text)",
};
