import Link from "next/link";
import type { ListingCategory, ListingStatus, ModerationState, TransactionType } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminListingSort, fetchAdminListings, fetchAreas, fetchCities } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { AdminListingsTable } from "@/components/AdminListingsTable";

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
  const createdFrom = str(sp.createdFrom);
  const createdTo = str(sp.createdTo);
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
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
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
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={hrefForTab(sp, t.value)}
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
          <input type="hidden" name="tab" value={tab} />

          {/* Title/Status/Category/Transaction/City/Area now filter from the table's own column
            * headers — only the filters with no single column of their own are left here. Their
            * values ride along as hidden inputs below so submitting this bar can't drop them. */}
          <Field label="User">
            <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
          </Field>

          <Field label="Created from">
            <input type="date" name="createdFrom" defaultValue={createdFrom} style={dateInputStyle} />
          </Field>
          <Field label="Created to">
            <input type="date" name="createdTo" defaultValue={createdTo} style={dateInputStyle} />
          </Field>
          <Field label="Modified from">
            <input type="date" name="updatedFrom" defaultValue={updatedFrom} style={dateInputStyle} />
          </Field>
          <Field label="Modified to">
            <input type="date" name="updatedTo" defaultValue={updatedTo} style={dateInputStyle} />
          </Field>

          {/* Not filter fields themselves — a plain GET form only submits its own named inputs,
            * so without these, using this bar would silently drop the active column sort, the
            * chosen columns, and every filter that now lives in a column header. */}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {str(sp.cols) && <input type="hidden" name="cols" value={str(sp.cols)} />}
          {search && <input type="hidden" name="search" value={search} />}
          {status && <input type="hidden" name="status" value={status} />}
          {category && <input type="hidden" name="category" value={category} />}
          {transactionType && <input type="hidden" name="transactionType" value={transactionType} />}
          {cityId && <input type="hidden" name="cityId" value={cityId} />}
          {areaId && <input type="hidden" name="areaId" value={areaId} />}

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
        </form>

        {/* Rendered even with no results — its header carries the column filters, so replacing
            it with a "nothing here" paragraph would take away the controls needed to widen
            whichever filter just emptied the table. The empty state is a row inside it. */}
        <AdminListingsTable items={result.items} sp={sp} cities={cities} areas={areas} />

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
