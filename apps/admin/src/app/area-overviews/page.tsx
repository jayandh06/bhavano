import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAreaOverviews } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { FullPageLink } from "@/components/FullPageLink";
import { AreaOverviewsTable } from "@/components/AreaOverviewsTable";
import { AREA_OVERVIEW_SORT_FIELDS, type AreaOverviewSortField } from "@bhavano/types/areaOverview";

const STATUS_FILTERS = [
  ["", "All statuses"],
  ["none", "No text yet"],
  ["draft", "Draft"],
  ["in_review", "In review"],
  ["published", "Published"],
] as const;

const FILTER_KEYS = ["status", "city", "q", "updatedFrom", "updatedTo", "minListings", "maxListings"] as const;

export default async function AreaOverviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, str(sp[key]) ?? ""])) as Record<(typeof FILTER_KEYS)[number], string>;
  const sortParam = str(sp.sort);
  const sort: AreaOverviewSortField = AREA_OVERVIEW_SORT_FIELDS.includes(sortParam as AreaOverviewSortField)
    ? (sortParam as AreaOverviewSortField)
    : "listings";
  const dir = str(sp.dir) === "asc" ? "asc" : "desc";
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const result = await fetchAreaOverviews(accessToken, { ...filters, sort, dir, offset: (currentPage - 1) * limit, limit });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  /** A header link keeps every filter, flips the direction when it is already the sort column, and
   * returns to page 1. */
  const sortHref = (field: AreaOverviewSortField) => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
    if (limit !== 25) params.set("limit", String(limit));
    params.set("sort", field);
    params.set("dir", field === sort ? (dir === "asc" ? "desc" : "asc") : field === "area" || field === "city" ? "asc" : "desc");
    return `/area-overviews?${params.toString()}`;
  };
  const filtered = FILTER_KEYS.some((key) => filters[key]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Area overviews</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>
          The reviewed text shown below the listings on an area page. Only <b>published</b> text reaches the site.{" "}
          {result.total.toLocaleString()} area{result.total === 1 ? "" : "s"}
          {filtered ? " match the filters" : ""}.
        </p>

        <form
          method="get"
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginBottom: 16,
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <Field label="Status">
            <select name="status" defaultValue={filters.status} style={inputStyle}>
              {STATUS_FILTERS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <select name="city" defaultValue={filters.city} style={inputStyle}>
              <option value="">All cities</option>
              {result.cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area">
            <input name="q" defaultValue={filters.q} placeholder="Search area" style={{ ...inputStyle, width: 170 }} />
          </Field>
          <Field label="Updated from">
            <input type="date" name="updatedFrom" defaultValue={filters.updatedFrom} style={inputStyle} />
          </Field>
          <Field label="Updated to">
            <input type="date" name="updatedTo" defaultValue={filters.updatedTo} style={inputStyle} />
          </Field>
          <Field label="Active listings">
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" min={0} name="minListings" defaultValue={filters.minListings} placeholder="Min" style={{ ...inputStyle, width: 70 }} />
              <span style={{ color: "var(--muted)" }}>to</span>
              <input type="number" min={0} name="maxListings" defaultValue={filters.maxListings} placeholder="Max" style={{ ...inputStyle, width: 70 }} />
            </span>
          </Field>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <button type="submit" style={{ ...inputStyle, fontWeight: 700, cursor: "pointer" }}>
            Apply
          </button>
          {filtered && (
            <FullPageLink href="/area-overviews" style={{ fontSize: 13, color: "var(--muted)", paddingBottom: 8 }}>
              Clear filters
            </FullPageLink>
          )}
        </form>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No areas match.</p>
        ) : (
          <AreaOverviewsTable
            items={result.items}
            sort={sort}
            dir={dir}
            sortHrefs={Object.fromEntries(AREA_OVERVIEW_SORT_FIELDS.map((f) => [f, sortHref(f)])) as Record<AreaOverviewSortField, string>}
          />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
      {label}
      {children}
    </label>
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
