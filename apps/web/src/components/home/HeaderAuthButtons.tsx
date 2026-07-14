"use client";

import Link from "next/link";
import { useAuthGate } from "./AuthGateProvider";

export function HeaderAuthButtons() {
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
    </div>
  );
}
