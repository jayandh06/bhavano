"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Area,
  City,
  ClaimSource,
  ListingCategory,
  ListingDetailDto,
  ListingSource,
  ListingStatus,
  SendPostedNotificationResponseDto,
  TransactionType,
} from "@bhavano/types";
import { sendBoostPromotionAction, sendPostedNotificationAction } from "@/app/actions/admin";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { AdminListingSortField } from "@/lib/bff";
import { formatDate } from "@/lib/formatDateTime";
import { buildSuffixSortHref, str, suffixSortDirectionFor, type SearchParams } from "@/lib/searchParams";
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { SortableHeader } from "@/components/SortableHeader";

/** The dashboard's listing moderation queue as an actual table — was previously a card list
 * with no view/like/message counts visible at all.
 *
 * A whole row opens the listing via a plain `onClick` + `router.push`, not the `<Link>`-stretched-
 * with-`position:absolute;inset:0`-over-a-`position:relative`-`<tr>` trick an earlier version
 * used. That trick keeps real anchor semantics (ctrl/cmd-click, middle-click, "copy link") for
 * free on desktop, but `position: relative` doesn't reliably establish a containing block for an
 * absolutely-positioned child on a table row across mobile browsers — confirmed broken: tapping a
 * row on a mobile browser didn't navigate at all. A plain click handler has none of table
 * layout's positioning quirks and works everywhere, at the cost of the anchor-only conveniences.
 * The checkbox cell still stops the click from bubbling to the row. `.admin-table-row`
 * (globals.css) adds the hover highlight and pointer cursor.
 *
 * This is a client component (selection state for the bulk "Send notification" action, see
 * UsersTable's identical pattern for welcome emails). Sorting, filtering and column choice are
 * all URL-driven regardless — sorting because the server needs the real order for pagination,
 * and column choice so it survives paging through results (client state would reset on every
 * page link, since pagination is a full-page navigation here).
 */

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

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

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "deactivated", label: "Deactivated" },
];

interface ListingColumn {
  /** Stable key used in `?cols=` — renaming one silently drops it from anybody's saved URL. */
  key: string;
  label: string;
  /** Omitted for columns with no orderable field behind them. */
  sortField?: AdminListingSortField;
  /** Rendered in the header's filter row. Omitted for columns the BFF can't filter on. */
  filter?: ReactNode;
  render: (item: ListingDetailDto) => ReactNode;
  /** Off-by-default columns exist so their already-supported filters have a home, without making
   * the default table even wider — Category/Transaction/City/Area were filterable long before
   * they were ever shown. */
  defaultVisible: boolean;
  nowrap?: boolean;
}

/** Which columns to render, from `?cols=` — falling back to the default set when absent, and
 * ignoring unknown keys so an old bookmark can't render a blank table. Order follows the column
 * registry, not the order the keys happen to appear in the URL. */
function visibleColumnKeys(sp: SearchParams, all: ListingColumn[]): Set<string> {
  const raw = str(sp.cols);
  if (raw === undefined) return new Set(all.filter((c) => c.defaultVisible).map((c) => c.key));
  const known = new Set(all.map((c) => c.key));
  const chosen = raw.split(",").map((k) => k.trim()).filter((k) => known.has(k));
  // An explicitly empty `?cols=` would otherwise render a table of nothing but checkboxes.
  return chosen.length > 0 ? new Set(chosen) : new Set(all.filter((c) => c.defaultVisible).map((c) => c.key));
}

export function AdminListingsTable({
  items,
  sp,
  cities,
  areas,
}: {
  items: ListingDetailDto[];
  sp: SearchParams;
  cities: City[];
  areas: Area[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Every row is selectable. Selection used to be limited to listings still missing the "your ad
  // is live" acknowledgement, which was right while that was the only bulk action — it is no
  // longer, and a Boost promotion is worth sending to exactly the ads that *did* get theirs. Each
  // action's own rules stay on the server, where they belong: the posted resend still refuses an
  // already-sent listing and the promotion still refuses one promoted recently, and both report
  // per-listing in the summary below.
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const pendingPostedCount = items.filter((item) => item.postedNotificationSent === false).length;

  const cityId = str(sp.cityId);

  const columns: ListingColumn[] = [
    {
      key: "title",
      label: "Title",
      sortField: "title",
      filter: <input name="search" defaultValue={str(sp.search) ?? ""} placeholder="contains…" style={headerInputStyle} />,
      render: (item) => item.title,
      defaultVisible: true,
    },
    {
      key: "status",
      label: "Listing status",
      sortField: "status",
      filter: (
        <select name="status" defaultValue={str(sp.status) ?? ""} style={headerSelectStyle}>
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ),
      render: (item) => <ListingStatusBadge status={item.status} isExpired={item.isExpired} />,
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "moderation",
      label: "Moderation",
      sortField: "moderationState",
      // No filter input: the Needs review / Flagged / All tabs above the table are this column's
      // filter, and a second control for the same field would just fight them.
      render: (item) => <StatusBadge moderationState={item.moderationState} adminReviewed={item.adminReviewed} />,
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "category",
      label: "Category",
      sortField: "category",
      filter: (
        <select name="category" defaultValue={str(sp.category) ?? ""} style={headerSelectStyle}>
          <option value="">Any</option>
          {(Object.keys(CATEGORY_LABELS) as ListingCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      ),
      render: (item) => CATEGORY_LABELS[item.category] ?? item.category,
      defaultVisible: false,
      nowrap: true,
    },
    {
      key: "transactionType",
      label: "Transaction",
      sortField: "transactionType",
      filter: (
        <select name="transactionType" defaultValue={str(sp.transactionType) ?? ""} style={headerSelectStyle}>
          <option value="">Any</option>
          {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      ),
      render: (item) => TRANSACTION_TYPE_LABELS[item.transactionType] ?? item.transactionType,
      defaultVisible: false,
      nowrap: true,
    },
    {
      key: "city",
      label: "City",
      // Searchable rather than a plain <select>, and auto-submitting: it binds to whichever form
      // contains it, which is this table's, and the Area field is on that same form. Without the
      // `areaId` reset, picking a new city would resubmit the old city's area and filter to
      // nothing. Area *must* auto-submit here too — its option list is fetched server-side for
      // the chosen city (see page.tsx), so the reload is what populates it.
      filter: (
        <SearchableSelect
          name="cityId"
          defaultValue={cityId}
          autoSubmit
          resetFieldsOnChange={["areaId"]}
          width={116}
          ariaLabel="Filter by city"
          placeholder="Search cities…"
          options={cities.map((c) => ({ value: c.id, label: c.name }))}
        />
      ),
      render: (item) => item.cityName,
      defaultVisible: false,
      nowrap: true,
    },
    {
      key: "area",
      label: "Area",
      // Still city-gated: `areas` is only fetched for the selected city, and the BFF's areaId
      // filter is per-city, so there's no meaningful all-cities area list to search.
      filter: (
        <SearchableSelect
          name="areaId"
          defaultValue={str(sp.areaId)}
          autoSubmit
          disabled={!cityId}
          disabledLabel="Pick a city"
          width={116}
          ariaLabel="Filter by area"
          placeholder="Search areas…"
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
        />
      ),
      render: (item) => item.area,
      defaultVisible: false,
      nowrap: true,
    },
    {
      key: "source",
      label: "Source",
      sortField: "source",
      render: (item) => <SourceBadge source={item.source} />,
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "claimSource",
      label: "Claimed via",
      sortField: "claimSource",
      render: (item) => <ClaimSourceBadge source={item.claimSource} />,
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "notification",
      label: "Notification",
      render: (item) => (
        <PostedNotificationBadge
          sent={item.postedNotificationSent}
          channel={item.postedNotificationChannel}
          sentAt={item.postedNotificationSentAt}
          deliveryStatus={item.postedNotificationDeliveryStatus}
        />
      ),
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "boostPromo",
      label: "Boost promo",
      render: (item) => <BoostPromoBadge promo={item.boostPromo} />,
      defaultVisible: true,
      nowrap: true,
    },
    { key: "views", label: "Views", sortField: "viewCount", render: (item) => item.viewCount, defaultVisible: true },
    { key: "likes", label: "Likes", sortField: "likeCount", render: (item) => item.likeCount, defaultVisible: true },
    {
      key: "messages",
      label: "Messages",
      sortField: "messageCount",
      render: (item) => item.messageCount ?? 0,
      defaultVisible: true,
    },
    {
      key: "price",
      label: "Price",
      sortField: "price",
      render: (item) => `${item.price}${item.priceQualifier ? ` ${item.priceQualifier}` : ""}`,
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "created",
      label: "Created",
      sortField: "createdAt",
      render: (item) => formatDate(item.createdAt),
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "updated",
      label: "Modified",
      sortField: "updatedAt",
      render: (item) => formatDate(item.updatedAt),
      defaultVisible: true,
      nowrap: true,
    },
    {
      key: "expires",
      label: "Expires",
      sortField: "expiresAt",
      render: (item) => formatDate(item.expiresAt),
      defaultVisible: false,
      nowrap: true,
    },
  ];

  const visibleKeys = visibleColumnKeys(sp, columns);
  const visible = columns.filter((c) => visibleKeys.has(c.key));
  const hasAnyFilter = visible.some((c) => c.filter);

  // A filter on a column that's currently hidden still applies (CarriedParams keeps it alive, as
  // it should — hiding a column shouldn't silently widen the result set). But with its input off
  // screen there's no way to tell why the table looks filtered, so say so explicitly.
  const hiddenActiveFilters = columns.filter(
    (c) => c.filter && !visibleKeys.has(c.key) && str(sp[filterNameFor(c)]),
  );

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Both bulk actions report the same shape, so they share one handler — only which server
   * action runs differs. */
  async function onSend(send: (listingIds: string[]) => Promise<SendPostedNotificationResponseDto | { success: false; error: string }>) {
    const listingIds = Array.from(selected);
    if (listingIds.length === 0) return;
    setPending(true);
    setSummary(null);

    const result = await send(listingIds);
    setPending(false);

    if ("success" in result && result.success === false) {
      setSummary(`Failed: ${result.error}`);
      return;
    }
    const ok = result as SendPostedNotificationResponseDto;
    const byId = new Map(items.map((item) => [item.id, item]));
    const failedDetail = ok.results
      .filter((r) => !r.success)
      .map((r) => `${byId.get(r.listingId)?.title ?? r.listingId}: ${r.error}`)
      .join(", ");
    setSummary(ok.failed > 0 ? `${ok.sent} sent, ${ok.failed} failed — ${failedDetail}` : `${ok.sent} sent`);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div>
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            padding: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} selected</span>
          <button onClick={() => void onSend(sendPostedNotificationAction)} disabled={pending} style={actionButtonStyle}>
            {pending ? "Sending…" : "Send posted notification"}
          </button>
          {/* Boost/Instant Alerts promotion to the owners of the selected live ads. Secondary
            * styling because it is the marketing one of the two: reaching for it should be a
            * decision, not the thing your cursor lands on. */}
          <button
            onClick={() => void onSend(sendBoostPromotionAction)}
            disabled={pending}
            style={secondaryActionButtonStyle}
            title="Emails (or WhatsApps) the owner a Boost / Instant Alerts offer linking straight to checkout for that ad"
          >
            {pending ? "Sending…" : "Send boost promo"}
          </button>
          {pendingPostedCount > 0 && (
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {pendingPostedCount} on this page never got the posted notification
            </span>
          )}
        </div>
      )}

      {summary && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>{summary}</p>}

      <ColumnSelector columns={columns} visibleKeys={visibleKeys} sp={sp} />

      {hiddenActiveFilters.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          Still filtering on{" "}
          {hiddenActiveFilters.map((c, i) => (
            <span key={c.key}>
              {i > 0 ? ", " : ""}
              <strong style={{ color: "var(--text-soft)" }}>
                {c.label}: {describeFilterValue(c, sp, cities, areas)}
              </strong>
            </span>
          ))}{" "}
          — turn {hiddenActiveFilters.length === 1 ? "that column" : "those columns"} back on above to change{" "}
          {hiddenActiveFilters.length === 1 ? "it" : "them"}.
        </p>
      )}

      {/* The table lives inside the filter form so the header inputs submit — a <form> can't be a
          child of <table>, but inputs inside cells bind to an ancestor form. The non-column
          filters (owner, date ranges) stay in the page's own bar, and both forms carry each
          other's values as hidden inputs so submitting either keeps the other's. */}
      <form method="get">
        <CarriedParams sp={sp} omit={["page", ...visible.filter((c) => c.filter).map((c) => filterNameFor(c))]} />
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                <th style={thStyle}>
                  {items.length > 0 && <input type="checkbox" checked={allSelected} onChange={toggleAll} />}
                </th>
                {visible.map((c) => (
                  <th key={c.key} style={thStyle}>
                    {c.sortField ? (
                      <SortableHeader
                        label={c.label}
                        href={buildSuffixSortHref("/", sp, c.sortField, "createdAt_desc")}
                        direction={suffixSortDirectionFor(sp, c.sortField, "createdAt_desc")}
                      />
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
              {hasAnyFilter && (
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={filterThStyle}>
                    <button type="submit" style={filterSubmitStyle} title="Apply column filters">
                      Go
                    </button>
                  </th>
                  {visible.map((c) => (
                    <th key={c.key} style={filterThStyle}>
                      {c.filter ?? null}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="admin-table-row"
                  onClick={() => router.push(`/listings/${item.id}`)}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                  </td>
                  {visible.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        ...tdStyle,
                        ...(c.nowrap ? { whiteSpace: "nowrap" as const } : {}),
                        ...(c.key === "title" ? { fontWeight: 700, maxWidth: 260 } : {}),
                      }}
                    >
                      {c.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
              {items.length === 0 && (
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  {/* Inside the table, so the header filters stay reachable — filtering down to
                      nothing must not remove the controls needed to widen the filter again. */}
                  <td
                    colSpan={visible.length + 1}
                    style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}
                  >
                    Nothing matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}

/** The query-param name a column's filter input uses — needed so `CarriedParams` doesn't emit a
 * hidden duplicate of a value the visible header input is already submitting. */
function filterNameFor(column: ListingColumn): string {
  if (column.key === "title") return "search";
  if (column.key === "city") return "cityId";
  if (column.key === "area") return "areaId";
  return column.key;
}

/** The hidden-filter notice's value, as something readable. City and Area filter by id, so the
 * raw param is a cuid — useless in a sentence meant to tell an admin what's narrowing the table.
 * Falls back to the raw value when the id isn't in the list we have (a stale bookmarked area id
 * from another city, say), since showing nothing at all would be worse. */
function describeFilterValue(column: ListingColumn, sp: SearchParams, cities: City[], areas: Area[]): string {
  const raw = str(sp[filterNameFor(column)]) ?? "";
  if (column.key === "city") return cities.find((c) => c.id === raw)?.name ?? raw;
  if (column.key === "area") return areas.find((a) => a.id === raw)?.name ?? raw;
  return raw;
}

/** Keeps every current query param alive through a submit of *this* form — a plain GET form only
 * sends its own named inputs, so without this, filtering by a header input would silently drop
 * the active sort, the chosen columns, the tab, the owner and the date ranges. `omit` covers the
 * params this form already has real inputs for (and `page`, since changing a filter should land
 * back on page 1). */
function CarriedParams({ sp, omit }: { sp: SearchParams; omit: string[] }) {
  const skip = new Set(omit);
  return (
    <>
      {Object.entries(sp).map(([key, value]) => {
        const v = str(value);
        if (!v || skip.has(key)) return null;
        return <input key={key} type="hidden" name={key} value={v} />;
      })}
    </>
  );
}

/** Which columns the table shows, as `?cols=` rather than client state — pagination here is a
 * full-page navigation, so a client-only choice would reset the moment the admin turned a page.
 * A plain `<details>` so it needs no popover/outside-click handling, and each checkbox is one
 * link rather than a form: toggling is a single navigation either way. */
function ColumnSelector({
  columns,
  visibleKeys,
  sp,
}: {
  columns: ListingColumn[];
  visibleKeys: Set<string>;
  sp: SearchParams;
}) {
  function hrefToggling(key: string): string {
    const next = new Set(visibleKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    const params = new URLSearchParams();
    for (const [k, value] of Object.entries(sp)) {
      if (k === "cols" || k === "page") continue;
      const v = str(value);
      if (v) params.set(k, v);
    }
    // Registry order, not click order, so the URL is stable regardless of how it was built.
    const ordered = columns.filter((c) => next.has(c.key)).map((c) => c.key);
    if (ordered.length > 0) params.set("cols", ordered.join(","));
    return `/?${params.toString()}`;
  }

  const hiddenCount = columns.length - visibleKeys.size;

  return (
    <details style={{ marginBottom: 12 }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--text-soft)",
          display: "inline-block",
          padding: "7px 12px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface)",
        }}
      >
        Columns ({visibleKeys.size}/{columns.length})
        {hiddenCount > 0 && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {hiddenCount} hidden</span>}
      </summary>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 8,
          padding: 12,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--surface)",
        }}
      >
        {columns.map((c) => {
          const on = visibleKeys.has(c.key);
          return (
            <Link
              key={c.key}
              href={hrefToggling(c.key)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${on ? "var(--green)" : "var(--border)"}`,
                color: on ? "var(--green)" : "var(--muted)",
                background: on ? "var(--surface-alt)" : "transparent",
                whiteSpace: "nowrap",
              }}
            >
              {on ? "✓ " : ""}
              {c.label}
            </Link>
          );
        })}
        {/* prefetch={false}: when no other filter is active this resolves to a bare "/" — the
          * same page it's rendered on — and see AdminNav.tsx's comment for why that specific case
          * needs prefetching disabled. */}
        <Link
          href={hrefResetting(sp)}
          prefetch={false}
          style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", alignSelf: "center" }}
        >
          Reset to default
        </Link>
      </div>
    </details>
  );
}

/** Drops `cols` entirely rather than listing the defaults out — an absent param is what "default
 * columns" means, so this keeps the URL clean and the default able to change later.
 *
 * When no other filter survives that drop, the result would otherwise be a bare "/" — the exact
 * shape middleware.ts's restore check is looking for, and this is a column reset, not a "please
 * bring back whatever filter I had" request. CLEAR_FILTERS_PARAM makes that explicit instead of
 * leaving it to look like a fresh arrival. */
function hrefResetting(sp: SearchParams): string {
  const params = new URLSearchParams();
  for (const [k, value] of Object.entries(sp)) {
    if (k === "cols" || k === "page") continue;
    const v = str(value);
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : `/?${CLEAR_FILTERS_PARAM}=1`;
}

const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Active",
  sold: "Sold",
  rented: "Rented",
  deactivated: "Deactivated",
};

/** The listing's own lifecycle state (active/sold/rented/deactivated) — distinct from the
 * moderation "Status" column next to it (needs review/reviewed/flagged), which is about admin
 * review, not whether the listing itself is live. A listing can be `status: active` and still
 * past its own `expiresAt` (isExpired) — the public `list()` only ever shows approved, active,
 * unexpired listings, so "Active" alone would be misleading for one a real visitor can no longer
 * see; shown as "Expired" instead in that case, since that's the more actionable fact here. */
function ListingStatusBadge({ status, isExpired }: { status: ListingStatus; isExpired: boolean }) {
  const label = status === "active" && isExpired ? "Expired" : LISTING_STATUS_LABELS[status];
  const color =
    status === "active" && isExpired
      ? "var(--danger)"
      : status === "active"
        ? "var(--green)"
        : status === "deactivated"
          ? "var(--danger)"
          : "var(--muted)";
  return <Badge label={label} color={color} />;
}

function StatusBadge({ moderationState, adminReviewed }: { moderationState: string; adminReviewed: boolean }) {
  const label = moderationState === "flagged" ? "Flagged" : adminReviewed ? "Reviewed" : "Needs review";
  const color = moderationState === "flagged" ? "var(--danger)" : adminReviewed ? "var(--green)" : "var(--muted)";
  return <Badge label={label} color={color} />;
}

const SOURCE_LABELS: Record<ListingSource, string> = {
  direct: "Direct",
  manual: "Manual",
  google_api: "Google API",
};

function SourceBadge({ source }: { source?: ListingSource }) {
  if (!source) return dash;
  return <Badge label={SOURCE_LABELS[source]} color="var(--muted)" borderColor="var(--border)" />;
}

const CLAIM_SOURCE_LABELS: Record<ClaimSource, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

/** Which outreach channel's claim link the owner actually clicked — see
 * Listing.claimSource's doc comment. Blank for a never-claimed (or non-bulk-imported) listing —
 * the overwhelming majority of rows. */
function ClaimSourceBadge({ source }: { source?: ClaimSource | null }) {
  if (!source) return dash;
  return <Badge label={CLAIM_SOURCE_LABELS[source]} color="var(--muted)" borderColor="var(--border)" />;
}

/** Whether the "your ad is live" acknowledgement was confirmed delivered — see
 * ListingDetailDto.postedNotificationSent's doc comment: derived from a real
 * ListingNotificationLog row, not a dispatch-attempted flag. Mirrors UsersTable's "welcomed"
 * badge for the same reason (a missing row could mean the owner has neither email nor phone, or
 * that the send itself failed — this doesn't distinguish those, it only says whether one landed). */
function PostedNotificationBadge({
  sent,
  channel,
  sentAt,
  deliveryStatus,
}: {
  sent?: boolean;
  channel?: string | null;
  sentAt?: string | null;
  deliveryStatus?: string | null;
}) {
  if (sent === undefined) return dash;
  const color = sent ? "var(--green)" : "var(--danger)";
  const label = sent
    ? `Sent · ${channel ?? "unknown"}${deliveryStatus ? ` · ${deliveryStatus}` : ""}${sentAt ? ` · ${formatDate(sentAt)}` : ""}`
    : "Not sent";
  return <Badge label={label} color={color} />;
}

/** Whether the Boost / Instant Alerts promotion has gone to this listing's owner, on which
 * channels, how many times and when the last one went.
 *
 * Counts, not a yes/no, because unlike the posted acknowledgement this one repeats: it can go
 * again after its 14-day cooldown, and "3× email, last in July" is a different decision from
 * "1×, yesterday" when choosing whether to send another. An owner with both an email and a phone
 * gets one row per channel per send, so `2× email · 2× WhatsApp` means two sends, not four.
 *
 * "WhatsApp", not "SMS": the promotion has never gone out over SMS — the two channels are the
 * templated WhatsApp message and the email. */
function BoostPromoBadge({ promo }: { promo?: { emailCount: number; whatsappCount: number; lastSentAt: string | null } }) {
  if (!promo) return dash;
  const parts = [
    promo.emailCount > 0 ? `${promo.emailCount}× email` : null,
    promo.whatsappCount > 0 ? `${promo.whatsappCount}× WhatsApp` : null,
  ].filter(Boolean);
  if (parts.length === 0) return <Badge label="Never sent" color="var(--muted)" borderColor="var(--border)" />;
  return (
    <Badge
      label={`${parts.join(" · ")}${promo.lastSentAt ? ` · ${formatDate(promo.lastSentAt)}` : ""}`}
      color="var(--green)"
    />
  );
}

/** One pill, so the badges above don't each carry their own copy of the same eight style
 * properties. */
function Badge({ label, color, borderColor }: { label: string; color: string; borderColor?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        color,
        border: `1px solid ${borderColor ?? color}`,
        borderRadius: 6,
        padding: "2px 8px",
      }}
    >
      {label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };

/** Tight under the labels it belongs to, with a bottom border so the two rows read as one header
 * block rather than the inputs looking like a first data row. */
const filterThStyle: React.CSSProperties = {
  padding: "0 8px 8px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};

const headerInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "5px 7px",
  fontSize: 12,
  background: "var(--surface)",
  color: "var(--text)",
  width: 120,
  fontWeight: 400,
};

const headerSelectStyle: React.CSSProperties = { ...headerInputStyle, width: 116 };

const filterSubmitStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  background: "none",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

const actionButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};
