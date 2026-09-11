import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchPlacesFetchLog } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { formatDateTime } from "@/lib/formatDateTime";

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
const dash = <span style={{ color: "var(--muted)" }}>—</span>;

/** Browses PlacesFetchLog — every Google Places search get_pg_coworking_leads.py has actually
 * run, one row per (city, area, category) query. "Contacts" links to /outreach/contacts filtered
 * by placesFetchLogId — the real FK, not a text match on sourceRef/query, so it's exact even
 * across repeated --force runs of the same area. See
 * docs/plans/pg-coworking-places-fetch-log.md. */
export default async function ScrapesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const cityId = str(sp.cityId);
  const businessCategory = str(sp.businessCategory);
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const result = await fetchPlacesFetchLog(accessToken, {
    offset: (currentPage - 1) * limit,
    limit,
    cityId,
    businessCategory,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <Link
          href="/outreach/contacts"
          style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}
        >
          ← Back to contacts
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Scrape history</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          Every Google Places search get_pg_coworking_leads.py has actually run, newest first —
          one row per (city, area, category) query, not per business. {result.total} record
          {result.total === 1 ? "" : "s"}.
        </p>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No scrapes logged yet.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  <th style={thStyle}>Fetched</th>
                  <th style={thStyle}>City</th>
                  <th style={thStyle}>Area</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Search term</th>
                  <th style={thStyle}>Found</th>
                  <th style={thStyle}>Imported</th>
                  <th style={thStyle}>Min rating</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.fetchedAt)}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      {row.citySearched}
                      {!row.cityId && (
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>not in Bhavano&apos;s City table</div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{row.areaSearched ?? "(city-level)"}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{row.businessCategory}</td>
                    <td style={{ ...tdStyle, maxWidth: 260 }}>
                      {row.queryPrefix}
                      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{row.query}</div>
                    </td>
                    <td style={tdStyle}>{row.resultsFound}</td>
                    <td style={tdStyle}>{row.resultsImported}</td>
                    <td style={tdStyle}>{row.minRatingFilter ?? dash}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      <Link
                        href={`/outreach/contacts?placesFetchLogId=${row.id}`}
                        style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}
                      >
                        Contacts →
                      </Link>
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
          buildHref={(p) => buildPageHref("/outreach/scrapes", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
