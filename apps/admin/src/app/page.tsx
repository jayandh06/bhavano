import Link from "next/link";
import type { ListingCategory, ListingStatus, ModerationState, TransactionType } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminListingSort, fetchAdminListings, fetchAreas, fetchCities } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { AdminListingsTable } from "@/components/AdminListingsTable";

type FilterTab = "needsReview" | "flagged" | "all";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "needsReview", label: "Needs review" },
  { value: "flagged", label: "Flagged" },
  { value: "all", label: "All listings" },
];

const CATEGORY_OPTIONS: { value: ListingCategory; label: string }[] = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "pg", label: "PG / Hostel" },
  { value: "storage", label: "Storage space" },
  { value: "coworking", label: "Coworking" },
  { value: "commercial", label: "Commercial space" },
  { value: "furniture", label: "Furniture" },
  { value: "interiors", label: "Interiors" },
];

const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "rent", label: "Rent" },
  { value: "lease", label: "Lease" },
];

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "deactivated", label: "Deactivated" },
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

          <Field label="User">
            <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
          </Field>

          <Field label="City">
            <AutoSubmitSelect
              name="cityId"
              defaultValue={cityId}
              resetFieldsOnChange={["areaId"]}
              style={selectStyle}
              options={[{ value: "", label: "Any city" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>

          <Field label="Area">
            <select name="areaId" defaultValue={areaId ?? ""} disabled={!cityId} style={selectStyle}>
              <option value="">{cityId ? "Any area" : "Select a city first"}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Category">
            <select name="category" defaultValue={category ?? ""} style={selectStyle}>
              <option value="">Any category</option>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Transaction type">
            <select name="transactionType" defaultValue={transactionType ?? ""} style={selectStyle}>
              <option value="">Any type</option>
              {TRANSACTION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select name="status" defaultValue={status ?? ""} style={selectStyle}>
              <option value="">Any status</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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

          {/* Not a filter field itself — carries whatever column sort is currently active
            * through a filter-form submit, which would otherwise drop it (plain GET, only
            * named inputs survive). */}
          {sort && <input type="hidden" name="sort" value={sort} />}

          <button type="submit" style={applyButtonStyle}>
            Apply filters
          </button>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing here.</p>
        ) : (
          <AdminListingsTable items={result.items} sp={sp} />
        )}

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

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "9px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

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
