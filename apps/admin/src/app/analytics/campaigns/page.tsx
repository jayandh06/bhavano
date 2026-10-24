import Link from "next/link";
import type { CampaignAnalyticsGroupByDto, CampaignAnalyticsRowDto } from "@bhavano/types/campaignAnalytics";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchCampaignAnalytics, type CampaignAnalyticsQuery } from "@/lib/bff";
import { buildSuffixSortHref, carriedValue, str, suffixSortDirectionFor, type SearchParams } from "@/lib/searchParams";
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { SelectField } from "@/components/SelectField";
import { SortableHeader } from "@/components/SortableHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FullPageLink } from "@/components/FullPageLink";

const BASE = "/analytics/campaigns";
const DEFAULT_SORT = "visits_desc";

const GROUP_BY_OPTIONS: { value: CampaignAnalyticsGroupByDto; label: string }[] = [
  { value: "campaign", label: "Campaign" },
  { value: "adGroup", label: "Ad group" },
  { value: "ad", label: "Ad" },
  { value: "source", label: "Source / medium" },
  { value: "landing", label: "Landing page" },
];

const TRAFFIC_OPTIONS = [
  { value: "humans", label: "Humans only" },
  { value: "js_confirmed", label: "JS-confirmed only (strictest)" },
  { value: "any", label: "Everything (with bots)" },
  { value: "bots", label: "Crawlers only" },
  { value: "unclassified", label: "Unclassified (pre-filter history)" },
];

const PLATFORM_OPTIONS = [
  { value: "any", label: "Website and app" },
  { value: "web", label: "Website only" },
  { value: "app", label: "Mobile app only" },
];

const DEVICE_OPTIONS = [
  { value: "any", label: "Any device" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile browser" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile_app", label: "Mobile app" },
];

const PAID_OPTIONS = [
  { value: "any", label: "Paid and organic" },
  { value: "paid", label: "Paid ad clicks only" },
  { value: "organic", label: "Not from an ad" },
];

const CONVERTED_OPTIONS = [
  { value: "any", label: "All rows" },
  { value: "yes", label: "Rows with a conversion" },
  { value: "no", label: "Rows with none" },
];

const GROUP_BY_VALUES = new Set(GROUP_BY_OPTIONS.map((o) => o.value));

/** What this page drills into: a campaign's rows by ad group, an ad group's rows by ad. */
const DRILL_DOWN: Partial<Record<CampaignAnalyticsGroupByDto, CampaignAnalyticsGroupByDto>> = {
  campaign: "adGroup",
  adGroup: "ad",
};

export default async function CampaignAnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const rawGroupBy = str(sp.groupBy);
  const groupBy = (rawGroupBy && GROUP_BY_VALUES.has(rawGroupBy as CampaignAnalyticsGroupByDto)
    ? rawGroupBy
    : "campaign") as CampaignAnalyticsGroupByDto;
  const traffic = str(sp.traffic) ?? "humans";
  const platform = str(sp.platform) ?? "any";
  const deviceType = str(sp.deviceType) ?? "any";
  const paid = str(sp.paid) ?? "any";
  const converted = str(sp.converted) ?? "any";
  const search = str(sp.search);
  const minVisits = str(sp.minVisits);
  const campaignId = str(sp.campaignId);
  const adGroupId = str(sp.adGroupId);
  const sort = str(sp.sort);
  // Like Page visits: absent dates default to a window without rewriting the URL.
  const from = str(sp.from) ?? daysAgoIST(7);
  const to = str(sp.to) ?? todayIST();

  const query: CampaignAnalyticsQuery = {
    from: istDayStart(from),
    to: istDayEnd(to),
    groupBy,
    traffic: traffic as CampaignAnalyticsQuery["traffic"],
    platform: platform as CampaignAnalyticsQuery["platform"],
    deviceType: deviceType === "any" ? undefined : deviceType,
    paid: paid as CampaignAnalyticsQuery["paid"],
    converted: converted as CampaignAnalyticsQuery["converted"],
    search,
    minVisits: minVisits ? Number(minVisits) : undefined,
    campaignId,
    adGroupId,
    sort,
  };
  const result = await fetchCampaignAnalytics(accessToken, query);
  const { rows, totals } = result;

  const sortHref = (field: string) => buildSuffixSortHref(BASE, sp, field, DEFAULT_SORT);
  const sortDir = (field: string) => suffixSortDirectionFor(sp, field, DEFAULT_SORT);

  // The drill-down chip names whatever the table is currently narrowed to.
  const drilledCampaign = campaignId ? (rows[0]?.campaignName ?? campaignId) : null;
  const drilledAdGroup = adGroupId ? (rows[0]?.adGroupName ?? adGroupId) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Campaign analytics</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px", maxWidth: 900, lineHeight: 1.6 }}>
          Where visits come from and what they did next. Every number counts <strong>sessions</strong> that
          started in the date range (IST). A sign-up or payment counts for the session when it happened within 24
          hours of that session starting. Click a campaign or ad group to drill into it; click a column to sort.
        </p>

        {(drilledCampaign || drilledAdGroup) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
              fontSize: 13,
            }}
          >
            Showing only <strong>{drilledAdGroup ?? drilledCampaign}</strong>
            <Link
              href={withParams(sp, { campaignId: undefined, adGroupId: undefined, groupBy: "campaign" })}
              prefetch={false}
              style={{ marginLeft: "auto", color: "var(--muted)", fontWeight: 700 }}
            >
              Back to all campaigns
            </Link>
          </div>
        )}

        <form method="get">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
              marginBottom: 16,
              padding: 16,
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
            }}
          >
            <Field label="Group by">
              <Select name="groupBy" value={groupBy} options={GROUP_BY_OPTIONS} />
            </Field>
            <Field label="Date range (IST)">
              <DateRangeFilter basePath={BASE} sp={sp} currentFrom={from} currentTo={to}>
                <Field label="From (IST)">
                  <input type="date" name="from" defaultValue={from} style={inputStyle} />
                </Field>
                <Field label="To (IST)">
                  <input type="date" name="to" defaultValue={to} style={inputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>
            <Field label="Traffic">
              <Select name="traffic" value={traffic} options={TRAFFIC_OPTIONS} />
            </Field>
            <Field label="Platform">
              <Select name="platform" value={platform} options={PLATFORM_OPTIONS} />
            </Field>
            <Field label="Device">
              <Select name="deviceType" value={deviceType} options={DEVICE_OPTIONS} />
            </Field>
            <Field label="Arrived from">
              <Select name="paid" value={paid} options={PAID_OPTIONS} />
            </Field>
            <Field label="Conversions">
              <Select name="converted" value={converted} options={CONVERTED_OPTIONS} />
            </Field>
            <Field label="Search name or id">
              <input name="search" defaultValue={search ?? ""} placeholder="e.g. Rent Out" style={{ ...inputStyle, minWidth: 170 }} />
            </Field>
            <Field label="Min visits">
              <input name="minVisits" type="number" min={0} defaultValue={minVisits ?? ""} style={{ ...inputStyle, width: 90 }} />
            </Field>

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            <Link
              href={`${BASE}?${CLEAR_FILTERS_PARAM}=1`}
              prefetch={false}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}
            >
              Reset
            </Link>
          </div>
          {/* Kept across Apply, so narrowing further does not drop the drill-down or the sort. */}
          {campaignId && <input type="hidden" name="campaignId" value={campaignId} />}
          {adGroupId && <input type="hidden" name="adGroupId" value={adGroupId} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
        </form>

        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                <th style={thStyle}>
                  <SortableHeader label={GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "Group"} href={sortHref("label")} direction={sortDir("label")} />
                </th>
                <NumberHeader label="Visits" field="visits" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Bots" field="bots" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Engaged (2+ pages)" field="engaged" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Reached /post" field="reachedPost" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Sign-ups" field="signups" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Sign-up %" field="signupRate" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Ads posted" field="posted" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Posted %" field="postedRate" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Paid" field="paid" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Paid %" field="paidRate" sortHref={sortHref} sortDir={sortDir} />
                <NumberHeader label="Revenue" field="revenue" sortHref={sortHref} sortDir={sortDir} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                    Nothing matches these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <Row key={row.key} row={row} groupBy={groupBy} sp={sp} />)
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--surface-alt)", fontWeight: 700 }}>
                  <td style={tdStyle}>
                    Total{result.truncated ? " (all matching, not only the rows shown)" : ""}
                  </td>
                  <Num>{totals.visits}</Num>
                  <Num>{totals.bots}</Num>
                  <Num>{totals.engaged}</Num>
                  <Num>{totals.reachedPost}</Num>
                  <Num>{totals.signups}</Num>
                  <Pct part={totals.signups} whole={totals.visits} />
                  <Num>{totals.posted}</Num>
                  <Pct part={totals.posted} whole={totals.visits} />
                  <Num>{totals.paid}</Num>
                  <Pct part={totals.paid} whole={totals.visits} />
                  <Rupees>{totals.revenue}</Rupees>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {result.truncated && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            More rows match than are shown. Narrow the filters or sort differently to see the rest.
          </p>
        )}

        <p style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 0", lineHeight: 1.7, maxWidth: 900 }}>
          <strong>Sign-ups</strong>: a new account created in that session. <strong>Ads posted</strong>: an ad
          posted from that session. <strong>Paid</strong>: the signed-in person made a payment within 24 hours of
          the session starting; <strong>Revenue</strong> is those payments in rupees. Percentages are of{" "}
          <em>visits</em>. <strong>Bots</strong> is zero unless Traffic lets crawlers in. Rows named{" "}
          <em>google / organic</em> and similar are visits that did not come from a numbered Google Ads
          campaign. Clicks and ad cost are not here yet: they live in Google Ads.
        </p>
      </div>
    </div>
  );
}

function Row({ row, groupBy, sp }: { row: CampaignAnalyticsRowDto; groupBy: CampaignAnalyticsGroupByDto; sp: SearchParams }) {
  const next = DRILL_DOWN[groupBy];
  const drillHref =
    row.fromAds && next
      ? withParams(sp, {
          groupBy: next,
          ...(groupBy === "campaign" ? { campaignId: row.key } : { adGroupId: row.key, campaignId: row.campaignId ?? undefined }),
        })
      : null;
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td style={tdStyle}>
        {drillHref ? (
          <Link href={drillHref} prefetch={false} style={{ color: "var(--green)", fontWeight: 700 }}>
            {row.label}
          </Link>
        ) : (
          <span style={{ fontWeight: 600 }}>{row.label}</span>
        )}
        {groupBy === "adGroup" && row.campaignName && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{row.campaignName}</div>
        )}
        {row.label !== row.key && row.fromAds && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>id {row.key}</div>
        )}
      </td>
      <Num>{row.visits}</Num>
      <Num>{row.bots}</Num>
      <Num>{row.engaged}</Num>
      <Num>{row.reachedPost}</Num>
      <Num>{row.signups}</Num>
      <Pct part={row.signups} whole={row.visits} />
      <Num>{row.posted}</Num>
      <Pct part={row.posted} whole={row.visits} />
      <Num>{row.paid}</Num>
      <Pct part={row.paid} whole={row.visits} />
      <Rupees>{row.revenue}</Rupees>
    </tr>
  );
}

/** This page's URL with some params replaced, everything else (dates, filters, sort) kept. */
function withParams(sp: SearchParams, change: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key in change || key === "page") continue;
    const v = carriedValue(key, value);
    if (v !== undefined) params.set(key, v);
  }
  for (const [key, value] of Object.entries(change)) {
    if (value !== undefined) params.set(key, value);
  }
  return `${BASE}?${params.toString()}`;
}

function NumberHeader({
  label,
  field,
  sortHref,
  sortDir,
}: {
  label: string;
  field: string;
  sortHref: (f: string) => string;
  sortDir: (f: string) => "asc" | "desc" | null;
}) {
  return (
    <th style={{ ...thStyle, textAlign: "right" }}>
      <SortableHeader label={label} href={sortHref(field)} direction={sortDir(field)} />
    </th>
  );
}

function Num({ children }: { children: number }) {
  return <td style={{ ...tdStyle, textAlign: "right" }}>{children.toLocaleString("en-IN")}</td>;
}

function Pct({ part, whole }: { part: number; whole: number }) {
  return (
    <td style={{ ...tdStyle, textAlign: "right", color: "var(--muted)" }}>
      {whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "–"}
    </td>
  );
}

function Rupees({ children }: { children: number }) {
  return <td style={{ ...tdStyle, textAlign: "right" }}>{children > 0 ? `₹${Math.round(children).toLocaleString("en-IN")}` : "–"}</td>;
}

function Select({ name, value, options }: { name: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <SelectField name={name} defaultValue={value} style={inputStyle}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </SelectField>
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

const inputStyle: React.CSSProperties = {
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
