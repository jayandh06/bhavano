import Link from "next/link";
import type { DeviceType } from "@bhavano/types";
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
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";
import { SortableHeader } from "@/components/SortableHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageVisitsTable } from "@/components/PageVisitsTable";

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
  { value: "js_confirmed", label: "JS-confirmed only (strictest)" },
  { value: "bots", label: "Crawlers only" },
  { value: "unclassified", label: "Unclassified (pre-filter history)" },
  { value: "any", label: "Everything" },
];

/** Humans-only by default: the screen was otherwise ~99.85% crawler sessions (one row per
 * request, because crawlers discard cookies — see isBotUserAgent). "Unclassified" is where all
 * the pre-filter history lives, since those rows kept no User-Agent to judge after the fact.
 *
 * Still `humans` rather than the stricter `js_confirmed`, deliberately: `js_confirmed` only
 * exists from 2026-09-16 onward, so defaulting to it would make every older session vanish from
 * the screen. Reach for it when a number has to be defensible — it requires that a JS engine
 * actually ran, which a scraper cannot fake by changing its User-Agent the way it can fake
 * `humans`. Revisit this default once there's a full window of confirmed history. */
const DEFAULT_TRAFFIC: AdminPageVisitTraffic = "humans";

const DEVICE_TYPE_OPTIONS: { value: DeviceType | "any"; label: string }[] = [
  { value: "any", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile_app", label: "Mobile App" },
];

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
  // Same silent-default pattern as DEFAULT_TRAFFIC above: absent from/to defaults to a 1-day
  // window rather than unbounded history, but doesn't redirect the URL to show it — the URL only
  // gains ?from=&to= once the visitor actually picks a range (a preset or Custom).
  const from = str(sp.from) ?? daysAgoIST(1);
  const to = str(sp.to) ?? todayIST();
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
              Avg <strong>{result.avgPageViewsPerSession.toFixed(1)}</strong> pages/session in the
              selected date range.
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

            <Field label="Date range (IST)">
              <DateRangeFilter basePath="/page-visits" sp={sp} currentFrom={from} currentTo={to}>
                <Field label="From (IST)">
                  <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
                </Field>
                <Field label="To (IST)">
                  <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            {/* CLEAR_FILTERS_PARAM + prefetch={false} — see logins/page.tsx's comment on the same
              * link shape, and rememberedFilters.ts's decideFilterAction for the full reasoning.
              * This screen is where the bug was actually observed: a plain bare "/page-visits"
              * href here was indistinguishable, to middleware.ts, from clicking the nav's own
              * "Page visits" tab while already on this screen — which isn't a reset at all. */}
            <Link
              href={`/page-visits?${CLEAR_FILTERS_PARAM}=1`}
              prefetch={false}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}
            >
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
              <PageVisitsTable
                items={result.items}
                traffic={traffic}
                unclassifiedHref={buildTrafficHref(sp, "unclassified")}
                everythingHref={buildTrafficHref(sp, "any")}
              />
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
