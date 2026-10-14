"use client";

import { useMemo, useState } from "react";
import type { City } from "@bhavano/types";
import { importContactsAction } from "@/app/actions/outreach";
import { mapCsvRows, parseCsv, type CsvImportRow } from "@/lib/outreachCsv";

const BATCH_SIZE = 25;

const input: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
};

const button = (color: string): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: 700,
  color,
  background: "none",
  border: `1px solid ${color}`,
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
});

/** Import reviewed contacts from a CSV, in the browser: upload → preview → untick → import.
 *
 * Understands the agent finder's results CSV (get_agent_leads_from_portals_apify.py) and a plain
 * sheet of name/phone/city. Rows are only pre-ticked when they are a mobile number (and, for the
 * finder's CSV, a "confident" match); landlines can't receive an SMS and are never pre-ticked.
 * Everything is imported with consent "none" — these people have not opted in. */
export function ImportContactsPanel({ cities }: { cities: City[] }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tags, setTags] = useState("portal-agent");
  const [category, setCategory] = useState("real_estate_agent");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const tagList = useMemo(() => tags.split(",").map((t) => t.trim()).filter(Boolean), [tags]);

  function load(csv: string, name: string) {
    const options = { cities, tags: tagList, businessCategory: category.trim(), sourceRef: `csv:${name}` };
    const mapped = mapCsvRows(parseCsv(csv), options);
    if ("error" in mapped) {
      setError(mapped.error);
      setRows([]);
      return;
    }
    setError(null);
    setSummary(null);
    setRows(mapped.rows);
    setSelected(new Set(mapped.rows.filter((r) => r.defaultSelected).map((r) => r.index)));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const csv = await file.text();
    setText(csv);
    load(csv, file.name);
  }

  // Tags and category apply to every row, so re-map from the same text when they change.
  function remap() {
    if (text) load(text, fileName);
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function onImport() {
    const chosen = rows.filter((r) => selected.has(r.index) && r.contact.phone);
    if (chosen.length === 0) return;
    setPending(true);
    setError(null);
    const totals = { created: 0, updated: 0, skipped: 0 };
    for (let i = 0; i < chosen.length; i += BATCH_SIZE) {
      const batch = chosen.slice(i, i + BATCH_SIZE).map((r) => r.contact);
      const result = await importContactsAction({ source: "scrape", sourceRef: `csv:${fileName}`, contacts: batch });
      if (!result.success) {
        setError(`${result.error} — ${totals.created + totals.updated} contacts were imported before this batch failed.`);
        setPending(false);
        return;
      }
      totals.created += result.result.created;
      totals.updated += result.result.updated;
      totals.skipped += result.result.skipped;
    }
    setPending(false);
    setSummary(`Imported ${chosen.length}: ${totals.created} new, ${totals.updated} updated, ${totals.skipped} skipped (no usable number). Consent is "none" for all of them.`);
    setRows([]);
    setSelected(new Set());
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...button("var(--green)"), marginBottom: 16 }}>
        Import CSV
      </button>
    );
  }

  const selectedCount = rows.filter((r) => selected.has(r.index) && r.contact.phone).length;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>Import contacts from CSV</div>
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
        Use the agent finder&apos;s results CSV or a sheet with name, phone and city columns. Ticked rows are
        imported with consent <strong>none</strong>; landlines can&apos;t receive an SMS and start unticked.
      </span>

      <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: 13 }} />

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
          Tags (comma-separated)
          <input style={input} value={tags} onChange={(e) => setTags(e.target.value)} onBlur={remap} />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
          Category
          <input style={input} value={category} onChange={(e) => setCategory(e.target.value)} onBlur={remap} />
        </label>
      </div>

      {error && <span style={{ fontSize: 12, color: "#b3413a" }}>{error}</span>}
      {summary && <span style={{ fontSize: 12.5, color: "var(--green)" }}>{summary}</span>}

      {rows.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {rows.length} rows · {selectedCount} ticked ·{" "}
            <button onClick={() => setSelected(new Set(rows.filter((r) => r.defaultSelected).map((r) => r.index)))} style={{ ...button("var(--text-soft)"), padding: "2px 8px", fontSize: 11.5 }}>
              Reset ticks
            </button>
          </div>
          <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", position: "sticky", top: 0, background: "var(--surface)" }}>
                  <th style={{ padding: "6px 8px" }} />
                  <th style={{ padding: "6px 8px" }}>Name</th>
                  <th style={{ padding: "6px 8px" }}>Phone</th>
                  <th style={{ padding: "6px 8px" }}>City</th>
                  <th style={{ padding: "6px 8px" }}>Match</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} style={{ borderTop: "1px solid var(--border)", opacity: r.contact.phone ? 1 : 0.5 }}>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.index)}
                        disabled={!r.contact.phone}
                        onChange={() => toggle(r.index)}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {r.contact.name}
                      {r.portalName && r.portalName !== r.contact.name && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>portal: {r.portalName}</div>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                      {r.contact.phone ?? "—"}
                      {r.kind && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: r.kind === "mobile" ? "var(--green)" : "#b3413a" }}>
                          {r.kind}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", color: r.cityMatched ? "var(--text)" : "#b3413a" }}>
                      {r.contact.cityId ? "✓" : "no city"}
                    </td>
                    <td style={{ padding: "6px 8px", color: "var(--muted)" }}>
                      {[r.matchStatus, r.matchScore].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onImport} disabled={pending || selectedCount === 0} style={button("var(--green)")}>
          {pending ? "Importing…" : `Import ${selectedCount} contact${selectedCount === 1 ? "" : "s"}`}
        </button>
        <button onClick={() => setOpen(false)} disabled={pending} style={button("var(--text-soft)")}>
          Close
        </button>
      </div>
    </div>
  );
}
