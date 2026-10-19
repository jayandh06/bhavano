import { requireAdmin } from "@/lib/requireAdmin";
import { fetchCityOverviews } from "@/lib/bff";
import { str, type SearchParams } from "@/lib/searchParams";
import { FullPageLink } from "@/components/FullPageLink";
import { CityOverviewsTable } from "@/components/CityOverviewsTable";

const STATUS_FILTERS = [
  ["", "All statuses"],
  ["none", "No text yet"],
  ["draft", "Draft"],
  ["in_review", "In review"],
  ["published", "Published"],
] as const;

export default async function CityOverviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const status = str(sp.status) ?? "";
  const q = str(sp.q) ?? "";
  const result = await fetchCityOverviews(accessToken, { status, q });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>City overviews</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>
          The reviewed text shown below the listings on a city page. Only <b>published</b> text reaches the site.{" "}
          {result.total} cit{result.total === 1 ? "y" : "ies"}. Area overviews are under{" "}
          <FullPageLink href="/area-overviews" style={{ color: "var(--green)", fontWeight: 700 }}>
            Area overviews
          </FullPageLink>
          .
        </p>
        <form method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
          <select name="status" defaultValue={status} style={inputStyle}>
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={q} placeholder="Search city" style={{ ...inputStyle, width: 170 }} />
          <button type="submit" style={{ ...inputStyle, fontWeight: 700, cursor: "pointer" }}>
            Apply
          </button>
        </form>
        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No cities match.</p>
        ) : (
          <CityOverviewsTable items={result.items} />
        )}
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
