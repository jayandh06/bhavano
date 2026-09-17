import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchSearchDemand } from "@/lib/bff";
import { str, type SearchParams } from "@/lib/searchParams";
import { formatDateTime } from "@/lib/formatDateTime";

const WINDOWS = [7, 30, 90] as const;

/**
 * What people search for, and — the column that matters — what they search for and don't find.
 *
 * Nothing recorded this before: `PageView` keeps only the path, and every filter lives in a query
 * param, so the whole homepage and every price/area/sort choice were invisible. A row here with a
 * high "found nothing" count is a recruitment target: people keep asking for that area and
 * category, and we have nothing to show them.
 */
export default async function SearchDemandPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const days = WINDOWS.includes(Number(str(sp.days)) as (typeof WINDOWS)[number]) ? Number(str(sp.days)) : 30;
  const demand = await fetchSearchDemand(accessToken, { days, limit: 100 });

  const emptyShare =
    demand.totalSearches > 0 ? Math.round((demand.totalEmptySearches / demand.totalSearches) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>What people search for</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px", maxWidth: 760 }}>
          Sorted by how often a search came back empty. Those are the gaps: people keep asking for
          that area and category and we have nothing to show them — which makes each row a target
          for{" "}
          <Link href="/outreach/campaigns" style={{ fontWeight: 700 }}>
            owner outreach
          </Link>
          . A search covering several areas counts once per area.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/search-demand?days=${w}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${days === w ? "var(--green)" : "var(--border)"}`,
                color: days === w ? "var(--green)" : "var(--text-soft)",
                background: days === w ? "var(--surface-alt)" : "var(--surface)",
              }}
            >
              Last {w} days
            </Link>
          ))}
          <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>
            <strong style={{ color: "var(--text)" }}>{demand.totalSearches.toLocaleString("en-IN")}</strong> searches,{" "}
            <strong style={{ color: emptyShare > 30 ? "var(--danger)" : "var(--text)" }}>
              {demand.totalEmptySearches.toLocaleString("en-IN")} ({emptyShare}%)
            </strong>{" "}
            found nothing
          </span>
        </div>

        {demand.rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No searches recorded in this window yet. Recording starts from the deploy on
            2026-09-17 — there is no history before that.
          </p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  {["City", "Area", "Category", "Type", "Searches", "Found nothing", "Avg results", "Last searched"].map(
                    (h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {demand.rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{row.cityName ?? dash}</td>
                    <td style={tdStyle}>{row.areaName ?? <span style={{ color: "var(--muted)" }}>any area</span>}</td>
                    <td style={tdStyle}>{row.category ?? dash}</td>
                    <td style={tdStyle}>{row.transactionType ?? dash}</td>
                    <td style={tdStyle}>{row.searches}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: row.emptySearches > 0 ? "var(--danger)" : "var(--muted)" }}>
                      {row.emptySearches}
                    </td>
                    <td style={tdStyle}>{row.avgResults}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.lastSearchedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {demand.topQueries.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "28px 0 4px" }}>Most-typed searches</h2>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>
              What people typed into the search box — the part no aggregate on filters alone can show.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {demand.topQueries.map((entry) => (
                <span
                  key={entry.q}
                  style={{
                    fontSize: 12.5,
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "5px 12px",
                    background: "var(--surface)",
                  }}
                >
                  {entry.q}{" "}
                  <strong style={{ color: "var(--muted)" }}>×{entry.searches}</strong>
                  {entry.emptySearches > 0 && (
                    <strong style={{ color: "var(--danger)" }}> · {entry.emptySearches} empty</strong>
                  )}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
