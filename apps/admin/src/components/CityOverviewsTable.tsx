"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCityOverviewRow, AreaOverviewStatus } from "@bhavano/types/areaOverview";
import { formatDateTime } from "@/lib/formatDateTime";

const STATUS_LABEL: Record<AreaOverviewStatus, string> = { draft: "Draft", in_review: "In review", published: "Published" };
const STATUS_COLOR: Record<AreaOverviewStatus, string> = { draft: "var(--muted)", in_review: "var(--gold)", published: "var(--green)" };

/** There are only a few dozen cities, so no paging and no bulk actions: click a row to open its
 * editor (ctrl/cmd-click for a new tab). The row you clicked stays lit while the page loads. */
export function CityOverviewsTable({ items }: { items: AdminCityOverviewRow[] }) {
  const router = useRouter();
  const [openingId, setOpeningId] = useState<string | null>(null);

  function open(event: { metaKey: boolean; ctrlKey: boolean }, cityId: string) {
    const href = `/city-overviews/${cityId}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank");
      return;
    }
    setOpeningId(cityId);
    router.push(href);
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
            {["City", "Active listings", "Status", "Reviewed by", "Updated"].map((h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr
              key={row.cityId}
              className={`admin-table-row${openingId === row.cityId ? " admin-table-row-active" : ""}`}
              tabIndex={0}
              aria-label={`Open ${row.cityName}`}
              onClick={(e) => open(e, row.cityId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target === e.currentTarget) open(e, row.cityId);
              }}
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <td style={{ ...tdStyle, fontWeight: 700 }}>{row.cityName}</td>
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
  );
}

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
