"use client";

import { useEffect, useRef, useState } from "react";
import type { ListingOwnerDto } from "@bhavano/types";
import { searchUsersAction } from "@/app/actions/users";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

function userLabel(user: ListingOwnerDto): string {
  return user.name ?? user.phone ?? user.email ?? user.id;
}

/** Type-ahead by name/phone/email, resolving to a userId. Renders two hidden inputs (id +
 * display label) as children of whatever <form> it's mounted in — selection only takes effect
 * when that form is submitted (e.g. the page's "Apply filters" button), matching every other
 * filter field's submission model. */
export function UserPicker({
  name,
  labelName,
  defaultUserId,
  defaultLabel,
}: {
  name: string;
  labelName: string;
  defaultUserId?: string;
  defaultLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListingOwnerDto[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(
    defaultUserId ? { id: defaultUserId, label: defaultLabel ?? defaultUserId } : null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setResults(await searchUsersAction(query.trim()));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function onPick(user: ListingOwnerDto) {
    setSelected({ id: user.id, label: userLabel(user) });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function onClear() {
    setSelected(null);
    setQuery("");
  }

  return (
    <div style={{ position: "relative", minWidth: 220 }}>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <input type="hidden" name={labelName} value={selected?.label ?? ""} />

      {selected ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid var(--border)",
            borderRadius: 9,
            padding: "9px 10px",
            fontSize: 13.5,
            background: "var(--surface)",
            color: "var(--text)",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.label}</span>
          <button
            type="button"
            onClick={onClear}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}
          >
            ×
          </button>
        </div>
      ) : (
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a dropdown option (which also fires blur) registers first.
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Search name, phone, or email…"
          style={{
            width: "100%",
            border: "1px solid var(--border)",
            borderRadius: 9,
            padding: "9px 10px",
            fontSize: 13.5,
            outline: "none",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
      )}

      {open && !selected && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 10,
            marginTop: 4,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onPick(user)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 10px",
                fontSize: 13,
                color: "var(--text)",
              }}
            >
              <div style={{ fontWeight: 700 }}>{userLabel(user)}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {[user.phone, user.email].filter(Boolean).join(" · ") || user.id}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
