import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminPageVisitSort, fetchPageVisits } from "@/lib/bff";
import { str } from "@/lib/searchParams";
import { formatDateTime } from "@/lib/formatDateTime";
import { UserPicker } from "@/components/UserPicker";

type SearchParams = Record<string, string | string[] | undefined>;

const SORT_OPTIONS: { value: AdminPageVisitSort; label: string }[] = [
  { value: "createdAt_desc", label: "Date — newest first" },
  { value: "createdAt_asc", label: "Date — oldest first" },
  { value: "user_asc", label: "User — grouped (A→Z)" },
  { value: "user_desc", label: "User — grouped (Z→A)" },
  { value: "city_asc", label: "City — A→Z" },
  { value: "city_desc", label: "City — Z→A" },
];

/** The date pickers are read as IST calendar days: an inclusive range from the start of the
 * "from" day to the last millisecond of the "to" day, both at +05:30. Kept as raw YYYY-MM-DD in
 * the URL (so the inputs round-trip); only widened to instants when calling the BFF. */
const IST_OFFSET = "+05:30";
const istDayStart = (d: string | undefined) => (d ? `${d}T00:00:00.000${IST_OFFSET}` : undefined);
const istDayEnd = (d: string | undefined) => (d ? `${d}T23:59:59.999${IST_OFFSET}` : undefined);

/** Carries every active filter forward alongside a new cursor. */
function loadMoreHref(sp: SearchParams, nextCursor: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("cursor", nextCursor);
  return `/page-visits?${params.toString()}`;
}

export default async function PageVisitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const cursor = str(sp.cursor);
  const userId = str(sp.userId);
  const userLabel = str(sp.userLabel);
  const from = str(sp.from);
  const to = str(sp.to);
  const source = str(sp.source);
  const medium = str(sp.medium);
  const ip = str(sp.ip);
  const landingPath = str(sp.landingPath);
  const city = str(sp.city);
  const region = str(sp.region);
  const country = str(sp.country);
  const sort = str(sp.sort) as AdminPageVisitSort | undefined;

  const page = await fetchPageVisits(accessToken, {
    cursor,
    from: istDayStart(from),
    to: istDayEnd(to),
    userId,
    source,
    medium,
    ip,
    landingPath,
    city,
    region,
    country,
    sort,
    limit: 50,
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Page visits</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
          One row per browser session. {page.total.toLocaleString()} match the current filters. Times and the
          date range are IST.
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
          Text filters: <Code>text</Code> contains · <Code>text%</Code> starts with · <Code>%text</Code> ends with ·{" "}
          <Code>{"{a, b, c}"}</Code> is any of (exact) · <Code>!</Code> prefix negates (e.g. <Code>!{"{google}"}</Code>,{" "}
          <Code>!spam%</Code>). All case-insensitive.
        </p>

        <form
          method="get"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
            marginBottom: 20,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <Field label="User">
            <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
          </Field>

          <Field label="Source">
            <input name="source" defaultValue={source} placeholder="e.g. google" style={textInputStyle} />
          </Field>
          <Field label="Medium">
            <input name="medium" defaultValue={medium} placeholder="e.g. cpc" style={textInputStyle} />
          </Field>
          <Field label="Landing path">
            <input name="landingPath" defaultValue={landingPath} placeholder="/bengaluru/..." style={textInputStyle} />
          </Field>
          <Field label="IP">
            <input name="ip" defaultValue={ip} placeholder="103.21." style={textInputStyle} />
          </Field>
          <Field label="City">
            <input name="city" defaultValue={city} placeholder="Bengaluru" style={textInputStyle} />
          </Field>
          <Field label="Region">
            <input name="region" defaultValue={region} placeholder="Karnataka" style={textInputStyle} />
          </Field>
          <Field label="Country">
            <input name="country" defaultValue={country} placeholder="India" style={textInputStyle} />
          </Field>

          <Field label="From (IST)">
            <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
          </Field>
          <Field label="To (IST)">
            <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
          </Field>

          <Field label="Sort by">
            <select name="sort" defaultValue={sort ?? "createdAt_desc"} style={selectStyle}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <button type="submit" style={applyButtonStyle}>
            Apply filters
          </button>
          <Link href="/page-visits" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reset
          </Link>
        </form>

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No visits match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  {["Time (IST)", "User", "Source", "Medium", "Campaign", "Landing path", "IP", "City", "Region", "Country"].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.items.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(v.createdAt)}</td>
                    <td style={tdStyle}>
                      {v.userId ? (
                        <Link href={`/users/${v.userId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                          {v.userName ?? v.userPhone ?? v.userEmail ?? v.userId}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>anonymous</span>
                      )}
                    </td>
                    <td style={tdStyle}>{v.source ?? dash}</td>
                    <td style={tdStyle}>{v.medium ?? dash}</td>
                    <td style={tdStyle}>{v.campaign ?? dash}</td>
                    <td style={{ ...tdStyle, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.landingPath ?? undefined}>
                      {v.landingPath ?? dash}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{v.ip ?? dash}</td>
                    <td style={tdStyle}>{v.ipCity ?? dash}</td>
                    <td style={tdStyle}>{v.ipRegion ?? dash}</td>
                    <td style={tdStyle}>{v.ipCountry ?? dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page.nextCursor && (
          <Link
            href={loadMoreHref(sp, page.nextCursor)}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--green)" }}
          >
            Load more →
          </Link>
        )}
      </div>
    </div>
  );
}

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
        borderRadius: 5,
        padding: "1px 5px",
        color: "var(--text)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </code>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const textInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

const selectStyle: React.CSSProperties = { ...textInputStyle };

const dateInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
};

const applyButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
