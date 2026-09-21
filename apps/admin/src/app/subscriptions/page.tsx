import Link from "next/link";
import type { PaymentPurpose, PaymentStatus } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminPaymentSort, AdminPaymentSortField, fetchPayments } from "@/lib/bff";
import {
  buildPageHref,
  buildSuffixSortHref,
  parsePage,
  parsePageSize,
  str,
  suffixSortDirectionFor,
  type SearchParams,
} from "@/lib/searchParams";
import { formatDate, formatDateTime } from "@/lib/formatDateTime";
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";
import { SortableHeader } from "@/components/SortableHeader";
import { RevokeBoostButton } from "@/components/RevokeBoostButton";

/** What the BFF falls back to with no `?sort=` — named here so the Date column's header still
 * shows its ▼ before anything has been clicked. */
const DEFAULT_SORT: AdminPaymentSort = "createdAt_desc";

const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  listing_boost: "Boost",
  buyer_premium: "Bhavano Plus",
  agent_pro: "Agent/Broker Pro",
  seller_slot_pack: "Seller Slot Pack",
  contact_reveal_credits: "Contact Reveal Credits",
  instant_alerts: "Instant Alerts",
};

const PURPOSE_OPTIONS: { value: PaymentPurpose | "any"; label: string }[] = [
  { value: "any", label: "All types" },
  { value: "listing_boost", label: "Boost" },
  { value: "buyer_premium", label: "Bhavano Plus" },
  { value: "agent_pro", label: "Agent/Broker Pro" },
  { value: "seller_slot_pack", label: "Seller Slot Pack" },
  { value: "contact_reveal_credits", label: "Contact Reveal Credits" },
  { value: "instant_alerts", label: "Instant Alerts" },
];

const STATUS_OPTIONS: { value: PaymentStatus | "any"; label: string }[] = [
  { value: "any", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "created", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: "var(--green)",
  created: "var(--gold, #b8860b)",
  failed: "#c0554b",
  refunded: "var(--muted)",
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  created: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

/** Same IST-day-picker convention as the page-visits screen — kept as raw YYYY-MM-DD in the URL
 * so the date inputs round-trip, only widened to instants when actually calling the BFF. */
const IST_OFFSET = "+05:30";
const istDayStart = (d: string | undefined) => (d ? `${d}T00:00:00.000${IST_OFFSET}` : undefined);
const istDayEnd = (d: string | undefined) => (d ? `${d}T23:59:59.999${IST_OFFSET}` : undefined);

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const userId = str(sp.userId);
  const userLabel = str(sp.userLabel);
  const purposeRaw = str(sp.purpose);
  const purpose = purposeRaw && purposeRaw !== "any" ? (purposeRaw as PaymentPurpose) : undefined;
  const statusRaw = str(sp.status);
  const status = statusRaw && statusRaw !== "any" ? (statusRaw as PaymentStatus) : undefined;
  const from = str(sp.from);
  const to = str(sp.to);
  const listingTitle = str(sp.listingTitle);
  const sort = str(sp.sort) as AdminPaymentSort | undefined;

  const result = await fetchPayments(accessToken, {
    offset: (currentPage - 1) * limit,
    from: istDayStart(from),
    to: istDayEnd(to),
    userId,
    purpose,
    status,
    listingTitle,
    sort,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  const sortHref = (field: AdminPaymentSortField) => buildSuffixSortHref("/subscriptions", sp, field, DEFAULT_SORT);
  const sortDir = (field: AdminPaymentSortField) => suffixSortDirectionFor(sp, field, DEFAULT_SORT);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Subscriptions</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          Every purchase — Boost, Bhavano Plus, Agent/Broker Pro, Seller Slot Pack, Contact Reveal Credits, and
          Instant Alerts — in one feed, not just Boosts. {result.total.toLocaleString()} match the current filters.
          Times and the date range are IST.
        </p>

        {/* Same reasoning as the page-visits screen: one <form> around both the filter bar and
            the table, since a <form> can't be a child of <table> but a cell's <input> still
            associates with an ancestor form. Sorting is plain links (SortableHeader), so
            clicking a column header doesn't need the Apply button. */}
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
            <Field label="User">
              <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
            </Field>

            <Field label="Type">
              <SelectField name="purpose" defaultValue={purpose ?? "any"} style={selectStyle}>
                {PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Status">
              <SelectField name="status" defaultValue={status ?? "any"} style={selectStyle}>
                {STATUS_OPTIONS.map((o) => (
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
            {/* CLEAR_FILTERS_PARAM + prefetch={false} — see logins/page.tsx's comment on the same
              * link shape, and rememberedFilters.ts's decideFilterAction for the full reasoning. */}
            <Link
              href={`/subscriptions?${CLEAR_FILTERS_PARAM}=1`}
              prefetch={false}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}
            >
              Reset
            </Link>
          </div>

          {/* Carried so a header-filter submit doesn't silently drop the active sort or page
              size. Page deliberately isn't carried — a changed filter should land on page 1. */}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {str(sp.limit) && <input type="hidden" name="limit" value={str(sp.limit)} />}

          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  <th style={thStyle}>
                    <SortableHeader label="Date" href={sortHref("createdAt")} direction={sortDir("createdAt")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Type" href={sortHref("purpose")} direction={sortDir("purpose")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="User" href={sortHref("user")} direction={sortDir("user")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Listing" href={sortHref("listing")} direction={sortDir("listing")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Amount" href={sortHref("amount")} direction={sortDir("amount")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Status" href={sortHref("status")} direction={sortDir("status")} />
                  </th>
                  {/* Resolved from whichever of four different purpose-specific audit-trail
                      rows this payment created — not a column on Payment itself, so it can't
                      be an orderBy target. See AdminPaymentDto's own doc comment. */}
                  <th style={thStyle}>Expiry</th>
                  <th style={thStyle}>Discount code</th>
                  <th style={thStyle} />
                </tr>
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle}>
                    <input
                      name="listingTitle"
                      defaultValue={listingTitle}
                      placeholder="2 BHK apartment…"
                      style={headerInputStyle}
                    />
                  </th>
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                </tr>
              </thead>
              <tbody>
                {result.items.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(p.createdAt)}</td>
                    <td style={tdStyle}>
                      {PURPOSE_LABELS[p.purpose]}
                      {p.boostDays ? ` (${p.boostDays}d)` : ""}
                      {p.boostIncludesInstantAlerts ? " + Instant Alerts" : ""}
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/users/${p.userId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                        {p.userName ?? p.userPhone ?? p.userEmail ?? p.userId}
                      </Link>
                    </td>
                    <td
                      style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={p.listingTitle ?? undefined}
                    >
                      {p.listingTitle ?? dash}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      {(p.amount / 100).toLocaleString("en-IN", { style: "currency", currency: p.currency, maximumFractionDigits: 0 })}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: STATUS_COLORS[p.status], fontWeight: 700 }}>{STATUS_LABELS[p.status]}</span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{p.expiresAt ? formatDate(p.expiresAt) : dash}</td>
                    <td style={tdStyle}>{p.discountCode ?? dash}</td>
                    <td style={tdStyle}>
                      {/* Manual override for support cases (a payment that should still get the
                          boost, or a refund) — only offered while there's an active boost to
                          revoke in the first place. Mirrors the old boosts-only page's own
                          gate (boostedUntil > now), now read off the resolved expiresAt. */}
                      {p.purpose === "listing_boost" && p.listingId && p.expiresAt && new Date(p.expiresAt) > new Date() && (
                        <RevokeBoostButton listingId={p.listingId} />
                      )}
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td colSpan={9} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}>
                      No purchases match these filters.
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
          buildHref={(p) => buildPageHref("/subscriptions", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

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
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

const dateInputStyle: React.CSSProperties = { ...selectStyle, minWidth: undefined };

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
  width: 140,
  fontWeight: 400,
};

const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
