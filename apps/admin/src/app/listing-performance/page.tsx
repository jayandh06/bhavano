import Link from "next/link";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { ListingPerformanceSort, ListingPerformanceSortField, fetchAreas, fetchCities, fetchListingPerformance } from "@/lib/bff";
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
import { Pagination } from "@/components/Pagination";
import { SortableHeader } from "@/components/SortableHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { SearchableSelect } from "@/components/SearchableSelect";
import { FullPageLink } from "@/components/FullPageLink";
import { formatDate } from "@/lib/formatDateTime";

/** Mirrors the BFF's default (see ListListingPerformanceDto) so the Created column still shows
 * its ▼ before anything has been clicked. */
const DEFAULT_SORT: ListingPerformanceSort = "createdAt_desc";

const CATEGORY_LABELS: Record<ListingCategory, string> = {
  house: "House",
  apartment: "Apartment",
  villa: "Villa",
  plot: "Plot",
  pg: "PG / Hostel",
  storage: "Storage",
  coworking: "Coworking",
  commercial: "Commercial",
  furniture: "Furniture",
  interiors: "Interiors",
};

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  rent: "Rent",
  lease: "Lease",
};

export default async function ListingPerformancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const cityId = str(sp.cityId);
  const areaId = str(sp.areaId);
  // Silent default to a 30-day window — see docs/plans/admin-listing-performance-screen.md's
  // "Default date range" section: this screen reviews posted-listing performance over a stretch,
  // not recent activity volume, so it needs longer than page-visits' 1 day or post-funnel's 7.
  const createdFrom = str(sp.createdFrom) ?? daysAgoIST(30);
  const createdTo = str(sp.createdTo) ?? todayIST();
  const sort = str(sp.sort) as ListingPerformanceSort | undefined;

  const [result, cities, areas] = await Promise.all([
    fetchListingPerformance(accessToken, {
      cityId,
      areaId,
      // Widened to full IST-day instants — see page.tsx's own comment on the same pattern: the
      // BFF does `new Date(createdFrom)` directly, and a bare "YYYY-MM-DD" parses as UTC midnight.
      createdFrom: istDayStart(createdFrom),
      createdTo: istDayEnd(createdTo),
      sort,
      offset: (currentPage - 1) * limit,
      limit,
    }),
    fetchCities(undefined, true),
    cityId ? fetchAreas(cityId, undefined, true) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  const sortHref = (field: ListingPerformanceSortField) => buildSuffixSortHref("/listing-performance", sp, field, DEFAULT_SORT);
  const sortDir = (field: ListingPerformanceSortField) => suffixSortDirectionFor(sp, field, DEFAULT_SORT);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Listing performance</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          One row per listing. {result.total.toLocaleString()} match the current filters. Date range filters by when
          the listing was posted — every stat shown is that listing&apos;s lifetime total, not activity within the
          window.
        </p>

        <form method="get">
          <div
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
            <Field label="City">
              <SearchableSelect
                name="cityId"
                defaultValue={cityId}
                autoSubmit
                resetFieldsOnChange={["areaId"]}
                width={180}
                ariaLabel="Filter by city"
                placeholder="Search cities…"
                options={cities.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label="Area">
              <SearchableSelect
                name="areaId"
                defaultValue={areaId}
                autoSubmit
                disabled={!cityId}
                disabledLabel="Pick a city"
                width={180}
                ariaLabel="Filter by area"
                placeholder="Search areas…"
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
              />
            </Field>

            <Field label="Posted (date range, IST)">
              <DateRangeFilter basePath="/listing-performance" sp={sp} currentFrom={createdFrom} currentTo={createdTo} fromParam="createdFrom" toParam="createdTo">
                <Field label="From (IST)">
                  <input type="date" name="createdFrom" defaultValue={createdFrom} style={dateInputStyle} />
                </Field>
                <Field label="To (IST)">
                  <input type="date" name="createdTo" defaultValue={createdTo} style={dateInputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>

            {sort && <input type="hidden" name="sort" value={sort} />}
            {str(sp.limit) && <input type="hidden" name="limit" value={str(sp.limit)} />}

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            <Link
              href={`/listing-performance?${CLEAR_FILTERS_PARAM}=1`}
              prefetch={false}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}
            >
              Reset
            </Link>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  <th style={thStyle}>
                    <SortableHeader label="Posted" href={sortHref("createdAt")} direction={sortDir("createdAt")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Title" href={sortHref("title")} direction={sortDir("title")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Category" href={sortHref("category")} direction={sortDir("category")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Type" href={sortHref("transactionType")} direction={sortDir("transactionType")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Views" href={sortHref("viewCount")} direction={sortDir("viewCount")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Organic views" href={sortHref("organicViewCount")} direction={sortDir("organicViewCount")} />
                  </th>
                  {/* Split from a groupBy over ListingView, not a column on Listing — can't be
                      ordered on, same accepted limitation AdminPageVisitSortField documents for
                      pageViewCount. */}
                  <th style={thStyle}>Logged-in views</th>
                  <th style={thStyle}>Anonymous views</th>
                  <th style={thStyle}>
                    <SortableHeader label="Enquiries" href={sortHref("enquiryCount")} direction={sortDir("enquiryCount")} />
                  </th>
                  <th style={thStyle}>Messages</th>
                  <th style={thStyle}>Unique senders</th>
                  <th style={thStyle}>Reply rate</th>
                  <th style={thStyle}>
                    <SortableHeader label="Favourites" href={sortHref("likeCount")} direction={sortDir("likeCount")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Contact reveals" href={sortHref("contactRevealCount")} direction={sortDir("contactRevealCount")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Boosted" href={sortHref("boosted")} direction={sortDir("boosted")} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)" }}>
                      No listings match the current filters.
                    </td>
                  </tr>
                ) : (
                  result.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={tdStyle}>{formatDate(item.createdAt)}</td>
                      <td style={{ ...tdStyle, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {item.cityName}
                          {item.area ? ` · ${item.area}` : ""}
                        </div>
                      </td>
                      <td style={tdStyle}>{CATEGORY_LABELS[item.category] ?? item.category}</td>
                      <td style={tdStyle}>{TRANSACTION_TYPE_LABELS[item.transactionType] ?? item.transactionType}</td>
                      <td style={tdStyle}>{item.viewCount.toLocaleString()}</td>
                      <td style={tdStyle}>{item.organicViewCount.toLocaleString()}</td>
                      <td style={tdStyle}>{item.loggedInViews.toLocaleString()}</td>
                      <td style={tdStyle}>{item.anonymousViews.toLocaleString()}</td>
                      <td style={tdStyle}>{item.enquiryCount.toLocaleString()}</td>
                      {/* Zero-enquiry rendering per the plan's "Edge cases" section: "0 of 0" reads
                          as "owner never replies," which is wrong when there was nothing to reply
                          to — so a dash instead, for messages/senders/reply-rate alike. */}
                      <td style={tdStyle}>{item.enquiryCount === 0 ? "—" : item.totalMessages.toLocaleString()}</td>
                      <td style={tdStyle}>{item.enquiryCount === 0 ? "—" : item.uniqueMessageSenders.toLocaleString()}</td>
                      <td style={tdStyle}>
                        {item.enquiryCount === 0 ? "—" : `${item.repliedThreads} of ${item.enquiryCount}`}
                      </td>
                      <td style={tdStyle}>{item.likeCount.toLocaleString()}</td>
                      <td style={tdStyle}>{item.contactRevealCount.toLocaleString()}</td>
                      <td style={tdStyle}>
                        {item.isBoosted ? (
                          <span style={{ color: "var(--green)", fontWeight: 700 }}>
                            Yes{item.boostedUntil ? ` (until ${formatDate(item.boostedUntil)})` : ""}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </form>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/listing-performance", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
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

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = { padding: "10px 12px", whiteSpace: "nowrap" };
