import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAreaOverviews } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { FullPageLink } from "@/components/FullPageLink";
import { formatDateTime } from "@/lib/formatDateTime";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", in_review: "In review", published: "Published" };
const STATUS_COLOR: Record<string, string> = { draft: "var(--muted)", in_review: "var(--gold)", published: "var(--green)" };
const FILTERS = [
  ["", "All"],
  ["none", "No text yet"],
  ["draft", "Draft"],
  ["in_review", "In review"],
  ["published", "Published"],
] as const;

export default async function AreaOverviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const status = str(sp.status);
  const q = str(sp.q);
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const result = await fetchAreaOverviews(accessToken, { status, q, offset: (currentPage - 1) * limit, limit });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Area overviews</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>
          The reviewed text shown below the listings on an area page. Only <b>published</b> text reaches the site.
          Areas with the most listings come first. {result.total.toLocaleString()} area{result.total === 1 ? "" : "s"}.
        </p>

        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <select name="status" defaultValue={status ?? ""} style={inputStyle}>
            {FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={q ?? ""} placeholder="Search area or city" style={{ ...inputStyle, minWidth: 220 }} />
          <button type="submit" style={buttonStyle}>
            Filter
          </button>
        </form>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No areas match.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  {["City", "Area", "Active listings", "Status", "Reviewed by", "Updated", ""].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.areaId} style={{ borderTop: "1px solid var(--border)" }}>
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
                    <td style={tdStyle}>
                      <FullPageLink href={`/area-overviews/${row.areaId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                        {row.status ? "Open" : "Write"}
                      </FullPageLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/area-overviews", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
};
const buttonStyle: React.CSSProperties = { ...inputStyle, fontWeight: 700, cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
