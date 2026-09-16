"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Second line under the label — e.g. an area's city, when the list spans more than one. */
  hint?: string;
}

/** Filtering starts once this many characters are typed; below it the list is a plain (capped)
 * preview. Matches UserPicker's own threshold, so the two type-aheads in this dashboard behave
 * the same even though one queries the server and this one doesn't. */
const MIN_QUERY_LENGTH = 2;

/** How many options to show before the admin has typed anything worth filtering on. A city has
 * hundreds of areas; rendering all of them into a 220px-tall scroller is just a worse version of
 * the native <select> this replaces. */
const PREVIEW_COUNT = 12;

/** Cap on rendered matches even *with* a query — a two-letter query can still match a lot. */
const RENDER_CAP = 60;

/** Where the open panel sits, in viewport coordinates. Exactly one of `top`/`bottom` is set —
 * both are resolved at measure time rather than during render, so nothing reads `window` while
 * rendering. */
interface Anchor {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

/**
 * A `<select>` replacement you can type into: a trigger showing the current selection, opening a
 * panel with a search box over a filtered option list. Selection resolves to a **hidden input**
 * named `name`, so it submits with whatever `<form>` this is mounted in exactly like the plain
 * `<select>` it replaced — no server round-trip and no client-side filter state to keep in sync
 * with the URL.
 *
 * Why not a native `<select>`: it can't be searched. Picking "Koramangala" out of a city's few
 * hundred areas meant scrolling a native dropdown, or knowing to type the first letters fast
 * enough for the browser's own (prefix-only, no-feedback) type-ahead to land. Filtering is a
 * plain case-insensitive substring match here, so "kora" and "mangala" both find it.
 *
 * Why not a server-backed type-ahead like UserPicker: the options are already on the page. The
 * listings dashboard fetches every city and (for the chosen city) every area to render the
 * filters at all, so searching them is local and instant. UserPicker hits the BFF because there
 * are too many users to ship to the client; that reasoning doesn't apply here.
 *
 * The hidden input is deliberately **uncontrolled** (`defaultValue` + a ref). Two reasons, both
 * about `autoSubmit`: `requestSubmit()` fires in the same tick as the click, before React has
 * flushed a state update, so a controlled input would still hold the *previous* value at submit
 * time; and `resetFieldsOnChange` blanks sibling fields by writing to the DOM directly (see
 * AutoSubmitSelect, same trick), which React would fight on a controlled input. `selected` state
 * exists only to render the label.
 */
export function SearchableSelect({
  name,
  defaultValue,
  options,
  emptyLabel = "Any",
  placeholder,
  disabled = false,
  disabledLabel,
  autoSubmit = false,
  resetFieldsOnChange,
  width = 116,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  options: SearchableSelectOption[];
  /** Label for the "no filter" choice, pinned to the top of the list. */
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Shown on the trigger instead of `emptyLabel` while disabled — say *why* it's disabled. */
  disabledLabel?: string;
  /** Submit the containing form as soon as an option is picked, rather than waiting for its own
   * submit button. Right for a deliberate pick-one-thing control; wrong for free text. */
  autoSubmit?: boolean;
  /** Field names on the same form to blank before an auto-submit — City must clear Area, or the
   * reload resubmits the old city's areaId and filters to nothing. */
  resetFieldsOnChange?: string[];
  width?: number;
  ariaLabel?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  // A selected value with no matching option shows as its raw id rather than silently reading as
  // "Any" — that only happens when the URL carries a stale id (e.g. an area from another city),
  // and an admin should be able to see that's what happened.
  const selectedLabel = selected ? (options.find((o) => o.value === selected)?.label ?? selected) : emptyLabel;

  const searching = query.trim().length >= MIN_QUERY_LENGTH;
  const matches = useMemo(() => {
    if (!searching) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, query, searching]);

  const shown = matches.slice(0, searching ? RENDER_CAP : PREVIEW_COUNT);
  // The clear row is always first and always reachable by keyboard, so backing out of a filter
  // never requires emptying the search box first.
  const rows: SearchableSelectOption[] = [{ value: "", label: emptyLabel }, ...shown];

  /** The panel is `position: fixed` against the trigger's measured rect, not absolutely
   * positioned inside it: this control lives in a `<th>` inside the table's `overflow-x: auto`
   * scroller, and an `overflow` value on one axis forces `auto` on the other — so an absolutely
   * positioned panel would be clipped by (and add scrollbars to) that container. Fixed
   * positioning escapes ancestor overflow entirely, at the cost of having to re-measure whenever
   * anything moves the trigger. */
  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = Math.max(rect.width, 232);
    const spaceBelow = window.innerHeight - rect.bottom;
    // Only flip up when there genuinely isn't room below *and* there's more room above.
    const flip = spaceBelow < 260 && rect.top > spaceBelow;
    const next: Anchor = {
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - panelWidth - 8)),
      width: panelWidth,
    };
    // Bail when nothing moved: scrolling the option list itself bubbles a `scroll` event up to
    // the window listener above, and a fresh object every time would re-render on every wheel
    // tick for no reason.
    setAnchor((prev) =>
      prev && prev.top === next.top && prev.bottom === next.bottom && prev.left === next.left && prev.width === next.width
        ? prev
        : next,
    );
  }, []);

  // Re-anchor rather than close, deliberately. Closing on resize looks fine on a desktop but
  // breaks the control on a phone: focusing the search box opens the on-screen keyboard, which
  // fires `resize` — so the panel would shut itself the instant it opened. `capture: true` on
  // scroll so the table's own horizontal scroller counts, not just the page.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  // Keep the highlighted row in view when it moves by keyboard rather than by pointer.
  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function openPanel() {
    if (disabled) return;
    measure();
    setQuery("");
    setHighlight(0);
    setOpen(true);
  }

  function pick(value: string) {
    setSelected(value);
    setOpen(false);
    setQuery("");
    if (!hiddenRef.current) return;
    hiddenRef.current.value = value;
    if (!autoSubmit) return;

    const form = hiddenRef.current.form;
    if (!form) return;
    for (const fieldName of resetFieldsOnChange ?? []) {
      const field = form.elements.namedItem(fieldName);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = "";
    }
    form.requestSubmit();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(rows.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row) pick(row.value);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width }}>
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue ?? ""} />

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
        aria-label={ariaLabel ?? name}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          ...triggerStyle,
          width: "100%",
          color: disabled ? "var(--muted)" : selected ? "var(--text)" : "var(--muted)",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {disabled ? (disabledLabel ?? emptyLabel) : selectedLabel}
        </span>
        <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: 6 }}>▾</span>
      </button>

      {open && anchor && (
        <div
          style={{
            position: "fixed",
            top: anchor.top,
            bottom: anchor.bottom,
            left: anchor.left,
            width: anchor.width,
            zIndex: 60,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Land on the first real match, not the "Any" row, so Enter picks what was typed.
              setHighlight(e.target.value.trim().length >= MIN_QUERY_LENGTH ? 1 : 0);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? `Type ${MIN_QUERY_LENGTH}+ letters…`}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "none",
              borderBottom: "1px solid var(--border)",
              padding: "8px 10px",
              fontSize: 12.5,
              outline: "none",
              background: "var(--surface)",
              color: "var(--text)",
            }}
          />

          <div ref={listRef} role="listbox" aria-label={ariaLabel ?? name} style={{ maxHeight: 220, overflowY: "auto" }}>
            {rows.map((row, i) => (
              <button
                key={row.value || "__any__"}
                type="button"
                role="option"
                aria-selected={row.value === selected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(row.value)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderBottom: i === 0 ? "1px solid var(--border)" : undefined,
                  cursor: "pointer",
                  padding: "7px 10px",
                  fontSize: 12.5,
                  background: i === highlight ? "var(--surface-alt)" : "transparent",
                  color: row.value === "" ? "var(--muted)" : "var(--text)",
                  fontWeight: row.value === selected ? 700 : 400,
                }}
              >
                {row.label}
                {row.hint && <div style={{ fontSize: 11, color: "var(--muted)" }}>{row.hint}</div>}
              </button>
            ))}

            {searching && matches.length === 0 && <p style={noteStyle}>No match for “{query.trim()}”.</p>}
          </div>

          {/* Say what's being hidden, in both directions — an admin who can't find an option
              needs to know whether to keep typing or whether it genuinely isn't there. */}
          {!searching && options.length > shown.length && (
            <p style={noteStyle}>
              Showing {shown.length} of {options.length} — type {MIN_QUERY_LENGTH} letters to search all of them.
            </p>
          )}
          {searching && matches.length > shown.length && (
            <p style={noteStyle}>
              {matches.length} matches, showing {shown.length} — keep typing to narrow.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "5px 7px",
  fontSize: 12,
  fontWeight: 400,
  background: "var(--surface)",
  textAlign: "left",
};

const noteStyle: React.CSSProperties = {
  margin: 0,
  padding: "7px 10px",
  borderTop: "1px solid var(--border)",
  fontSize: 11,
  color: "var(--muted)",
};
