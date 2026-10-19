"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AREA_OVERVIEW_REVIEW_CHECKLIST,
  type AdminAreaOverviewRow,
  type AreaOverviewSortField,
  type AreaOverviewStatus,
} from "@bhavano/types/areaOverview";
import { bulkSetAreaOverviewStatusAction } from "@/app/actions/area-overviews";
import { FullPageLink } from "@/components/FullPageLink";
import { formatDateTime } from "@/lib/formatDateTime";

const STATUS_LABEL: Record<AreaOverviewStatus, string> = { draft: "Draft", in_review: "In review", published: "Published" };
const STATUS_COLOR: Record<AreaOverviewStatus, string> = { draft: "var(--muted)", in_review: "var(--gold)", published: "var(--green)" };

const COLUMNS: { label: string; field?: AreaOverviewSortField }[] = [
  { label: "City", field: "city" },
  { label: "Area", field: "area" },
  { label: "Active listings", field: "listings" },
  { label: "Status", field: "status" },
  { label: "Reviewed by" },
  { label: "Updated", field: "updated" },
];

export function AreaOverviewsTable({
  items,
  sort,
  dir,
  sortHrefs,
}: {
  items: AdminAreaOverviewRow[];
  sort: AreaOverviewSortField;
  dir: "asc" | "desc";
  sortHrefs: Record<AreaOverviewSortField, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"publish" | null>(null);
  const [ticked, setTicked] = useState<boolean[]>(AREA_OVERVIEW_REVIEW_CHECKLIST.map(() => false));
  const [busy, setBusy] = useState(false);
  /** The row that was just clicked open: it stays highlighted while the editor page loads. */
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [report, setReport] = useState<{ kind: "ok" | "error"; text: string; failures: string[] } | null>(null);

  // Only rows that have text can be published; a row with no text yet has nothing to approve.
  const selectable = items.filter((i) => i.status !== null);
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.areaId));
  const labelFor = new Map(items.map((i) => [i.areaId, `${i.areaName}, ${i.cityName}`]));
  const allTicked = ticked.every(Boolean);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  /** A plain click opens the editor in this tab; ctrl/cmd-click opens it in a new one. The checkbox
   * cell stops its own clicks from reaching here. A plain handler rather than a stretched link,
   * for the reason given in AdminListingsTable. */
  function openRow(event: { metaKey: boolean; ctrlKey: boolean }, areaId: string) {
    const href = `/area-overviews/${areaId}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank");
      return;
    }
    setOpeningId(areaId);
    router.push(href);
  }

  async function run(status: "published" | "draft") {
    setBusy(true);
    setReport(null);
    const result = await bulkSetAreaOverviewStatusAction([...selected], status, allTicked);
    setBusy(false);
    if (!result.success) {
      setReport({ kind: "error", text: result.error, failures: [] });
      return;
    }
    const failed = result.results.filter((r) => !r.ok);
    const done = result.results.length - failed.length;
    setReport({
      kind: failed.length === 0 ? "ok" : "error",
      text:
        status === "published"
          ? `${done} published${failed.length ? `, ${failed.length} not published` : ""}. Published text reaches the site within about an hour.`
          : `${done} moved back to draft${failed.length ? `, ${failed.length} failed` : ""}.`,
      failures: failed.map((f) => `${labelFor.get(f.areaId) ?? f.areaId}: ${f.error}`),
    });
    setSelected(new Set(failed.map((f) => f.areaId)));
    setPanel(null);
    setTicked(AREA_OVERVIEW_REVIEW_CHECKLIST.map(() => false));
    router.refresh();
  }

  return (
    <>
      {selected.size > 0 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            marginBottom: 12,
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 13 }}>{selected.size} selected</b>
            <button type="button" onClick={() => setPanel(panel ? null : "publish")} disabled={busy} style={primaryButton}>
              Publish selected
            </button>
            <button type="button" onClick={() => run("draft")} disabled={busy} style={button}>
              Move to draft
            </button>
            <button type="button" onClick={() => setSelected(new Set())} disabled={busy} style={button}>
              Clear selection
            </button>
          </div>
          {panel === "publish" && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--muted)" }}>
                Publishing records you as the approver for every selected area. Tick all items to confirm you have
                reviewed each one. An area whose text fails a check is skipped and reported.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {AREA_OVERVIEW_REVIEW_CHECKLIST.map((item, i) => (
                  <label key={item} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "flex-start" }}>
                    <input
                      type="checkbox"
                      checked={ticked[i]}
                      onChange={(e) => setTicked(ticked.map((t, j) => (j === i ? e.target.checked : t)))}
                      style={{ marginTop: 3 }}
                    />
                    {item}
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => run("published")} disabled={busy || !allTicked} style={primaryButton}>
                {busy ? "Publishing…" : `Approve and publish ${selected.size}`}
              </button>
            </div>
          )}
        </div>
      )}

      {report && (
        <div style={{ marginBottom: 12, fontSize: 13, color: report.kind === "ok" ? "var(--green)" : "var(--danger)" }}>
          <div>{report.text}</div>
          {report.failures.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {report.failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
              <th style={{ ...thStyle, width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((i) => i.areaId)))}
                />
              </th>
              {COLUMNS.map((col) => (
                <th key={col.label || "actions"} style={thStyle}>
                  {col.field ? (
                    <FullPageLink href={sortHrefs[col.field]} style={{ color: "inherit", textDecoration: "none" }}>
                      {col.label} {sort === col.field ? (dir === "asc" ? "▲" : "▼") : ""}
                    </FullPageLink>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.areaId}
                className={`admin-table-row${selected.has(row.areaId) ? " admin-table-row-selected" : ""}${openingId === row.areaId ? " admin-table-row-active" : ""}`}
                tabIndex={0}
                aria-label={`Open ${row.areaName}, ${row.cityName}`}
                onClick={(e) => openRow(e, row.areaId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target === e.currentTarget) openRow(e, row.areaId);
                }}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.areaName}`}
                    checked={selected.has(row.areaId)}
                    disabled={row.status === null}
                    title={row.status === null ? "No text yet" : undefined}
                    onChange={() => toggle(row.areaId)}
                  />
                </td>
                <td style={tdStyle}>{row.cityName}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{row.areaName}</td>
                <td style={tdStyle}>{row.activeListings}</td>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 700, color: row.status ? STATUS_COLOR[row.status] : "var(--muted)" }}>
                    {row.status ? STATUS_LABEL[row.status] : "No text yet"}
                  </span>
                </td>
                <td style={tdStyle}>{row.reviewedByName ?? "—"}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{row.updatedAt ? formatDateTime(row.updatedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
const button: React.CSSProperties = {
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 700,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
};
const primaryButton: React.CSSProperties = { ...button, background: "var(--green)", color: "var(--on-green)", borderColor: "var(--green)" };
