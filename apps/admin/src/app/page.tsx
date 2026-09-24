import Link from "next/link";
import type { ListingCategory, ListingStatus, ModerationState, TransactionType } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminListingSort, fetchAdminListings, fetchAreas, fetchCities } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { AdminListingsTable } from "@/components/AdminListingsTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";

type FilterTab = "needsReview" | "flagged" | "all";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "needsReview", label: "Needs review" },
  { value: "flagged", label: "Flagged" },
  { value: "all", label: "All listings" },
];

function tabToQuery(tab: FilterTab): { moderationState?: ModerationState; adminReviewed?: boolean } {
  if (tab === "needsReview") return { adminReviewed: false };
  if (tab === "flagged") return { moderationState: "flagged" };
  return {};
}

/** Every other filter field survives a tab switch by carrying the full current query string
 * forward — only `tab` itself gets overwritten, and `page` is dropped (a tab switch changes the
 * result set, so a page number from the old tab can easily be out of range for the new one). */
function hrefForTab(sp: SearchParams, tab: FilterTab): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "page") continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("tab", tab);
  return `/?${params.toString()}`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const tabParam = str(sp.tab) ?? "needsReview";
  const tab: FilterTab = TABS.some((t) => t.value === tabParam) ? (tabParam as FilterTab) : "needsReview";

  const search = str(sp.search);
  const userId = str(sp.userId);
  const userLabel = str(sp.userLabel);
  // Silent default to a 1-day window, same pattern as page-visits/page.tsx's DEFAULT_TRAFFIC —
  // confirmed with the user that this applies to Listings too, so the moderation queue defaults
  // to "created today" rather than unbounded history. Doesn't redirect the URL to show it.
  const createdFrom = str(sp.createdFrom) ?? daysAgoIST(1);
  const createdTo = str(sp.createdTo) ?? todayIST();
  const updatedFrom = str(sp.updatedFrom);
  const updatedTo = str(sp.updatedTo);
  const category = str(sp.category) as ListingCategory | undefined;
  const transactionType = str(sp.transactionType) as TransactionType | undefined;
  const status = str(sp.status) as ListingStatus | undefined;
  const cityId = str(sp.cityId);
  const areaId = str(sp.areaId);
  const sort = str(sp.sort) as AdminListingSort | undefined;
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const [result, cities, areas] = await Promise.all([
    fetchAdminListings(accessToken, {
      ...tabToQuery(tab),
      search,
      category,
      transactionType,
      status,
      cityId,
      areaId,
      userId,
      // Widened to full IST-day instants here, same as page-visits/page.tsx already does for
      // from/to — the BFF does `new Date(createdFrom)` directly on whatever it's given, and a
      // bare "YYYY-MM-DD" parses as UTC midnight. For a single-day range (the "1 day" preset
      // sends the *same* date string for both ends) that made gte and lte the exact same instant
      // — a zero-width window that could only ever match a listing created at that literal
      // millisecond, i.e. none. createdFrom/createdTo (the bare strings) stay as they are for the
      // <input> defaultValue and DateRangeFilter's preset-matching, which both need the
      // unwidened YYYY-MM-DD form.
      createdFrom: istDayStart(createdFrom),
      createdTo: istDayEnd(createdTo),
      updatedFrom: istDayStart(updatedFrom),
      updatedTo: istDayEnd(updatedTo),
      sort,
      offset: (currentPage - 1) * limit,
      limit,
    }),
    fetchCities(undefined, true),
    cityId ? fetchAreas(cityId, undefined, true) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px" }}>Listing moderation</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {/* prefetch={false} — same reasoning as SortableHeader.tsx/Pagination.tsx: all three
            * tabs are always visible together, so Next would proactively prefetch every one on
            * load (each one harmless data-wise, since hrefForTab always carries a real query, but
            * still a background request nobody asked for). */}
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={hrefForTab(sp, t.value)}
              prefetch={false}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${tab === t.value ? "var(--green)" : "var(--border)"}`,
                color: tab === t.value ? "var(--green)" : "var(--text-soft)",
                background: tab === t.value ? "var(--surface-alt)" : "var(--surface)",
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* One form for the whole screen (same shape as logins/page.tsx): top-bar fields and
          * column-header filters submit together via the single "Apply filters" button. A second
          * "Go" submit in the table used to fight this — changing a column filter and then hitting
          * Apply would drop whatever the other form owned, and vice versa. */}
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
            <input type="hidden" name="tab" value={tab} />

            {/* Title/Status/Category/Transaction/City/Area filter from the table column headers
              * below (same form). Only filters with no single column of their own live here. */}
            <Field label="User">
              <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
            </Field>

            <Field label="Created (date range)">
              <DateRangeFilter basePath="/" sp={sp} currentFrom={createdFrom} currentTo={createdTo} fromParam="createdFrom" toParam="createdTo">
                <Field label="Created from">
                  <input type="date" name="createdFrom" defaultValue={createdFrom} style={dateInputStyle} />
                </Field>
                <Field label="Created to">
                  <input type="date" name="createdTo" defaultValue={createdTo} style={dateInputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>
            <Field label="Modified from">
              <input type="date" name="updatedFrom" defaultValue={updatedFrom} style={dateInputStyle} />
            </Field>
            <Field label="Modified to">
              <input type="date" name="updatedTo" defaultValue={updatedTo} style={dateInputStyle} />
            </Field>

            {/* Sort / columns / page size are link-driven, not inputs — carry them so Apply
              * doesn't silently drop them. Column filter values come from the table header. */}
            {sort && <input type="hidden" name="sort" value={sort} />}
            {str(sp.cols) && <input type="hidden" name="cols" value={str(sp.cols)} />}
            {str(sp.limit) && <input type="hidden" name="limit" value={str(sp.limit)} />}

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            {/* CLEAR_FILTERS_PARAM + prefetch={false} — see logins/page.tsx's comment on the same
              * link shape, and rememberedFilters.ts's decideFilterAction for the full reasoning. */}
            <Link
              href={`/?${CLEAR_FILTERS_PARAM}=1`}
              prefetch={false}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}
            >
              Reset
            </Link>
          </div>

          {/* Rendered even with no results — its header carries the column filters, so replacing
              it with a "nothing here" paragraph would take away the controls needed to widen
              whichever filter just emptied the table. The empty state is a row inside it. */}
          <AdminListingsTable items={result.items} sp={sp} cities={cities} areas={areas} />
        </form>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/", sp, p)}
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
