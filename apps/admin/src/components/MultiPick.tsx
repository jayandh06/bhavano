"use client";

import { useState } from "react";

export interface PickOption {
  value: string;
  label: string;
}

/** A checklist for choosing any number of values from a known list — used for the campaign
 * audience (categories, cities), where typing free text would let a typo silently match nobody.
 * A search box appears for long lists (the city list has dozens of entries). */
export function MultiPick({
  label,
  options,
  selected,
  onChange,
  emptyHint,
}: {
  label: string;
  options: PickOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const shown = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
        {label}
        <span style={{ fontWeight: 400 }}>
          {selected.length === 0 ? " — any" : ` — ${selected.length} selected`}
        </span>
      </div>
      {options.length > 8 && (
        <input
          placeholder={`Search ${label.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 12.5,
          }}
        />
      )}
      <div
        style={{
          maxHeight: 130,
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 10px",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 14px",
        }}
      >
        {options.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{emptyHint ?? "Nothing to choose from yet."}</span>
        )}
        {shown.map((o) => (
          <label key={o.value} style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
