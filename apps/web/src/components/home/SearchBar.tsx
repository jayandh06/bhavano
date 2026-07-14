"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildHomeUrl } from "@/lib/homeUrl";

export function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  function submit() {
    router.push(buildHomeUrl(searchParams, { q: value || undefined }));
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0 6px 0 14px",
        minWidth: 0,
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: 15 }}>🔍</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Search '2BHK in Koramangala', 'PG near IT park', 'sofa set'…"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          padding: "12px 10px",
          fontSize: 14,
          background: "transparent",
          minWidth: 0,
          color: "var(--text)",
        }}
      />
      <button
        onClick={submit}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: "none",
          borderRadius: 7,
          padding: "9px 18px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </div>
  );
}
