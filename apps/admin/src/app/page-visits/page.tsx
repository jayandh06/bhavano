import Link from "next/link";
import type { DeviceType, PageVisitDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  AdminPageVisitIdentity,
  AdminPageVisitSort,
  AdminPageVisitSortField,
  AdminPageVisitTraffic,
  fetchPageVisits,
} from "@/lib/bff";
import {
  buildPageHref,
  buildSuffixSortHref,
  parsePage,
  parsePageSize,
  str,
  suffixSortDirectionFor,
  type SearchParams,
} from "@/lib/searchParams";
import { formatDateTime } from "@/lib/formatDateTime";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";
import { SortableHeader } from "@/components/SortableHeader";

/** What the BFF falls back to with no `?sort=` — named here so the Time column's header still
 * shows its ▼ before anything has been clicked. */
const DEFAULT_SORT: AdminPageVisitSort = "createdAt_desc";

const IDENTITY_OPTIONS: { value: AdminPageVisitIdentity; label: string }[] = [
  { value: "any", label: "All visits" },
  { value: "anonymous", label: "Anonymous only" },
  { value: "logged_in", label: "Logged in only" },
];

const TRAFFIC_OPTIONS: { value: AdminPageVisitTraffic; label: string }[] = [
  { value: "humans", label: "Humans only" },
  { value: "bots", label: "Crawlers only" },
  { value: "unclassified", label: "Unclassified (pre-filter history)" },
  { value: "any", label: "Everything" },
];

/** Humans-only by default: the screen was otherwise ~99.85% crawler sessions (one row per
 * request, because crawlers discard cookies — see isBotUserAgent). "Unclassified" is where all
 * the pre-filter history lives, since those rows kept no User-Agent to judge after the fact. */
const DEFAULT_TRAFFIC: AdminPageVisitTraffic = "humans";

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

const DEVICE_TYPE_OPTIONS: { value: DeviceType | "any"; label: string }[] = [
  { value: "any", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile_app", label: "Mobile App" },
];

/** The date pickers are read as IST calendar days: an inclusive range from the start of the
 * "from" day to the last millisecond of the "to" day, both at +05:30. Kept as raw YYYY-MM-DD in
 * the URL (so the inputs round-trip); only widened to instants when calling the BFF. */
const IST_OFFSET = "+05:30";
const istDayStart = (d: string | undefined) => (d ? `${d}T00:00:00.000${IST_OFFSET}` : undefined);
const istDayEnd = (d: string | undefined) => (d ? `${d}T23:59:59.999${IST_OFFSET}` : undefined);

export default async function PageVisitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const userId = str(sp.userId);
  const userLabel = str(sp.userLabel);
  const identity = str(sp.identity) as AdminPageVisitIdentity | undefined;
  const traffic = (str(sp.traffic) as AdminPageVisitTraffic | undefined) ?? DEFAULT_TRAFFIC;
  const deviceTypeRaw = str(sp.deviceType);
  const deviceType = deviceTypeRaw && deviceTypeRaw !== "any" ? (deviceTypeRaw as DeviceType) : undefined;
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

  const result = await fetchPageVisits(accessToken, {
    offset: (currentPage - 1) * limit,
    from: istDayStart(from),
    to: istDayEnd(to),
    userId,
    identity,
    traffic,
    deviceType,
    source,
    medium,
    ip,
    landingPath,
    city,
    region,
    country,
    sort,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  const sortHref = (field: AdminPageVisitSortField) => buildSuffixSortHref("/page-visits", sp, field, DEFAULT_SORT);
  const sortDir = (field: AdminPageVisitSortField) => suffixSortDirectionFor(sp, field, DEFAULT_SORT);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Page visits</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
          One row per browser session. {result.total.toLocaleString()} match the current filters. Times and the
          date range are IST.
          {result.avgPageViewsPerSession !== null && (
            <>
              {" "}
              Avg <strong>{result.avgPageViewsPerSession.toFixed(1)}</strong> pages/session
              {from || to ? " in the selected date range" : " overall"}.
            </>
          )}
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
          Text filters: <Code>text</Code> contains · <Code>text%</Code> starts with · <Code>%text</Code> ends with ·{" "}
          <Code>{"{a, b, c}"}</Code> is any of (exact) · <Code>!</Code> prefix negates (e.g. <Code>!{"{google}"}</Code>,{" "}
          <Code>!spam%</Code>). All case-insensitive.
        </p>

        {/* One form around both the range/identity bar and the table, so the per-column filter
            inputs living in the header cells submit together with these — a <form> can't be a
            child of <table>, but inputs inside cells associate with an ancestor form just fine.
            Sorting is the exception: those are plain links (SortableHeader), so clicking a column
            doesn't require pressing Apply. */}
        <form method="get">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
              marginBottom: 12,
              padding: 16,
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
            }}
          >
            {/* These four don't map onto a single column the way the header filters do — a user
                lookup is an autocomplete, identity is a null-vs-not-null question about the user
                column, and the dates bound the range the summary counts above describe. */}
            <Field label="User">
              <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
            </Field>

            <Field label="Identity">
              <SelectField name="identity" defaultValue={identity ?? "any"} style={selectStyle}>
                {IDENTITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Traffic">
              <SelectField name="traffic" defaultValue={traffic} style={selectStyle}>
                {TRAFFIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="From (IST)">
              <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
            </Field>
            <Field label="To (IST)">
              <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
            </Field>

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            <Link href="/page-visits" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
              Reset
            </Link>
          </div>

          {/* Carried so a header-filter submit doesn't silently drop the active sort (links set
              it, this preserves it) or the chosen page size. Page deliberately isn't carried —
              changing a filter should land back on page 1. */}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {str(sp.limit) && <input type="hidden" name="limit" value={str(sp.limit)} />}

          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  <th style={thStyle}>
                    <SortableHeader label="Time (IST)" href={sortHref("createdAt")} direction={sortDir("createdAt")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="User" href={sortHref("user")} direction={sortDir("user")} />
                  </th>
                  {/* Counted from PageView in a separate groupBy, not a column on Visit — see
                      PAGE_VISIT_SORT_VALUES' own comment for why it can't be ordered on. */}
                  <th style={thStyle}>Pages</th>
                  <th style={thStyle}>
                    <SortableHeader label="Device" href={sortHref("deviceType")} direction={sortDir("deviceType")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Source" href={sortHref("source")} direction={sortDir("source")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Medium" href={sortHref("medium")} direction={sortDir("medium")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="UTM campaign" href={sortHref("campaign")} direction={sortDir("campaign")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Campaign" href={sortHref("campaignId")} direction={sortDir("campaignId")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Ad group" href={sortHref("adGroupId")} direction={sortDir("adGroupId")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Landing path" href={sortHref("landingPath")} direction={sortDir("landingPath")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="IP" href={sortHref("ip")} direction={sortDir("ip")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="City" href={sortHref("city")} direction={sortDir("city")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Region" href={sortHref("region")} direction={sortDir("region")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Country" href={sortHref("country")} direction={sortDir("country")} />
                  </th>
                </tr>
                {/* Filter row — one input per filterable column, directly under its own heading
                    rather than in a legend above the table. Enter submits (it's a real form), so
                    Apply above is for the range/identity controls more than for these. */}
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle}>
                    <SelectField name="deviceType" defaultValue={deviceType ?? "any"} style={headerSelectStyle}>
                      {DEVICE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectField>
                  </th>
                  <th style={filterThStyle}>
                    <input name="source" defaultValue={source} placeholder="google" style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle}>
                    <input name="medium" defaultValue={medium} placeholder="cpc" style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle}>
                    <input name="landingPath" defaultValue={landingPath} placeholder="/bengaluru/…" style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle}>
                    <input name="ip" defaultValue={ip} placeholder="103.21." style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle}>
                    <input name="city" defaultValue={city} placeholder="Bengaluru" style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle}>
                    <input name="region" defaultValue={region} placeholder="Karnataka" style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle}>
                    <input name="country" defaultValue={country} placeholder="India" style={headerInputStyle} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(v.createdAt)}</td>
                    <td style={tdStyle}>
                      <SessionUsers visit={v} />
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/page-visits/${v.sessionId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                        {v.pageViewCount}
                      </Link>
                    </td>
                    <td style={tdStyle}>{v.deviceType ? DEVICE_TYPE_LABELS[v.deviceType] : dash}</td>
                    <td style={tdStyle}>{v.source ?? dash}</td>
                    <td style={tdStyle}>{v.medium ?? dash}</td>
                    <td style={tdStyle}>{v.campaign ?? dash}</td>
                    <td style={tdStyle}>{v.campaignName ?? v.campaignId ?? dash}</td>
                    <td style={tdStyle}>{v.adGroupName ?? v.adGroupId ?? dash}</td>
                    <td style={{ ...tdStyle, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.landingPath ?? undefined}>
                      {v.landingPath ?? dash}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{v.ip ?? dash}</td>
                    <td style={tdStyle}>{v.ipCity ?? dash}</td>
                    <td style={tdStyle}>{v.ipRegion ?? dash}</td>
                    <td style={tdStyle}>{v.ipCountry ?? dash}</td>
                  </tr>
                ))}
                {/* Inside the table, not instead of it — filtering down to zero used to replace
                    the whole thing with a bare paragraph, taking the filter inputs away with it
                    and leaving no way to widen the filter that just emptied the page. */}
                {result.items.length === 0 && (
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td colSpan={14} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}>
                      No visits match these filters.
                      {/* Expected right after the crawler filter shipped, and confusing without
                          saying so: every session recorded before it has no stored User-Agent to
                          judge, so none of them can be called human. Only sessions recorded from
                          then on are classified. */}
                      {traffic === "humans" && (
                        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                          Only sessions recorded since the crawler filter shipped are classified — older ones have no
                          stored User-Agent to judge. Switch Traffic to{" "}
                          <Link href={buildTrafficHref(sp, "unclassified")} style={{ color: "var(--green)", fontWeight: 700 }}>
                            Unclassified
                          </Link>{" "}
                          for the history, or{" "}
                          <Link href={buildTrafficHref(sp, "any")} style={{ color: "var(--green)", fontWeight: 700 }}>
                            Everything
                          </Link>
                          .
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </form>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/page-visits", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

/** Same URL with a different Traffic value, keeping every other filter and dropping `page`
 * (a different traffic class has a different row count, so an old page number can be out of
 * range). Used by the empty state's "try Unclassified/Everything" links. */
function buildTrafficHref(sp: SearchParams, traffic: AdminPageVisitTraffic): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "traffic" || key === "page") continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("traffic", traffic);
  return `/page-visits?${params.toString()}`;
}

/**
 * Every account that logged in during this session, not just `Visit.userId`.
 *
 * `Visit` holds one userId, so it can only ever name whoever logged in *first* — a session where
 * two accounts sign in (a shared desktop, or one person signing up by phone and then by Google
 * seconds later) used to show only the first, and the second was absent from this screen
 * entirely. `sessionLogins` comes from `LoginEvent.sessionId` instead, so all of them show.
 *
 * Two or more here is also worth a second look: it's usually one person who now has two accounts
 * (see docs/plans/account-linking-phone-and-email.md), which is why they're flagged rather than
 * just listed.
 */
function SessionUsers({ visit }: { visit: PageVisitDto }) {
  const logins = visit.sessionLogins;

  // Pre-LoginEvent.sessionId rows have no logins recorded, so fall back to whatever the Visit
  // itself names rather than claiming the session was anonymous.
  if (logins.length === 0) {
    if (!visit.userId) return <span style={{ color: "var(--muted)" }}>anonymous</span>;
    return (
      <Link href={`/users/${visit.userId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
        {visit.userName ?? visit.userPhone ?? visit.userEmail ?? visit.userId}
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {logins.map((l) => (
        <Link
          key={l.userId}
          href={`/users/${l.userId}`}
          style={{ color: "var(--green)", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          {l.name ?? l.phone ?? l.email ?? l.userId}
          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11 }}> · {l.method}</span>
        </Link>
      ))}
      {logins.length > 1 && (
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gold, #b8860b)", whiteSpace: "nowrap" }}>
          {logins.length} accounts — possible duplicate
        </span>
      )}
    </div>
  );
}

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

/** The filter row sits tight under the labels it belongs to — less vertical padding than the
 * label row above it, and a bottom border so the two read as one header block rather than the
 * filter inputs looking like a first data row. */
const filterThStyle: React.CSSProperties = {
  padding: "0 8px 8px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};

/** Narrower than the standalone filter-bar inputs (textInputStyle's 150px min would force the
 * 14-column table far wider than it already is) — these only need to hold a short prefix. */
const headerInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "5px 7px",
  fontSize: 12,
  background: "var(--surface)",
  color: "var(--text)",
  width: 110,
  fontWeight: 400,
};

const headerSelectStyle: React.CSSProperties = { ...headerInputStyle, width: 120 };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
