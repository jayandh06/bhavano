import Link from "next/link";
import type { ClaimSource, ListingDetailDto, ListingSource, ListingStatus } from "@bhavano/types";
import { formatDate } from "@/lib/formatDateTime";
import { str, type SearchParams } from "@/lib/searchParams";

/** The dashboard's listing moderation queue as an actual table — was previously a card list
 * with no view/like/message counts visible at all. Plain server component, no interactivity:
 * a whole row is still clickable via a stretched-link (`<Link>` positioned to cover the title
 * `<td>`'s row via `inset: 0` on a `position: relative` `<tr>`) rather than a client-side
 * onClick, so this never needs "use client". Sortable headers are a full-page `<Link>` for the
 * same reason — the server needs the real order for pagination anyway. */

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

export function AdminListingsTable({ items, sp }: { items: ListingDetailDto[]; sp: SearchParams }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>
              <SortableHeader label="Listing status" sp={sp} ascValue="status_asc" descValue="status_desc" />
            </th>
            <th style={thStyle}>Moderation</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Claimed via</th>
            <th style={thStyle}>Notification</th>
            <th style={thStyle}>Views</th>
            <th style={thStyle}>Likes</th>
            <th style={thStyle}>Messages</th>
            <th style={thStyle}>Price</th>
            <th style={thStyle}>
              <SortableHeader label="Created" sp={sp} ascValue="createdAt_asc" descValue="createdAt_desc" />
            </th>
            <th style={thStyle}>
              <SortableHeader label="Modified" sp={sp} ascValue="updatedAt_asc" descValue="updatedAt_desc" />
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...tdStyle, position: "relative", fontWeight: 700, maxWidth: 260 }}>
                <Link
                  href={`/listings/${item.id}`}
                  aria-label={item.title}
                  style={{ position: "absolute", inset: 0 }}
                />
                {item.title}
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <ListingStatusBadge status={item.status} isExpired={item.isExpired} />
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <StatusBadge moderationState={item.moderationState} adminReviewed={item.adminReviewed} />
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <SourceBadge source={item.source} />
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <ClaimSourceBadge source={item.claimSource} />
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <PostedNotificationBadge
                  sent={item.postedNotificationSent}
                  channel={item.postedNotificationChannel}
                  sentAt={item.postedNotificationSentAt}
                  deliveryStatus={item.postedNotificationDeliveryStatus}
                />
              </td>
              <td style={tdStyle}>{item.viewCount}</td>
              <td style={tdStyle}>{item.likeCount}</td>
              <td style={tdStyle}>{item.messageCount ?? 0}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                {item.price}
                {item.priceQualifier ? ` ${item.priceQualifier}` : ""}
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDate(item.createdAt)}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDate(item.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A sortable column header — full-page navigation (not a client re-sort), toggling between
 * ascValue/descValue rather than the generic field-prefix convention outreach's own
 * SortableHeader uses, since AdminListingSort's values are distinct literal strings per
 * field+direction (e.g. "createdAt_desc"), not a single field name with a leading "-". */
function SortableHeader({
  label,
  sp,
  ascValue,
  descValue,
}: {
  label: string;
  sp: SearchParams;
  ascValue: string;
  descValue: string;
}) {
  const current = str(sp.sort);
  const direction = current === ascValue ? "asc" : current === descValue ? "desc" : null;
  const nextValue = current === ascValue ? descValue : ascValue;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "sort" || key === "page") continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("sort", nextValue);
  return (
    <Link
      href={`/?${params.toString()}`}
      style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      {label}
      <span style={{ color: direction ? "var(--text)" : "var(--muted)", fontSize: 10 }}>
        {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
      </span>
    </Link>
  );
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
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: "2px 8px",
      }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ moderationState, adminReviewed }: { moderationState: string; adminReviewed: boolean }) {
  const label = moderationState === "flagged" ? "Flagged" : adminReviewed ? "Reviewed" : "Needs review";
  const color = moderationState === "flagged" ? "var(--danger)" : adminReviewed ? "var(--green)" : "var(--muted)";
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: "2px 8px",
      }}
    >
      {label}
    </span>
  );
}

const SOURCE_LABELS: Record<ListingSource, string> = {
  direct: "Direct",
  manual: "Manual",
  google_api: "Google API",
};

function SourceBadge({ source }: { source?: ListingSource }) {
  if (!source) return dash;
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--muted)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "2px 8px",
      }}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
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
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--muted)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "2px 8px",
      }}
    >
      {CLAIM_SOURCE_LABELS[source]}
    </span>
  );
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
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: "2px 8px",
      }}
    >
      {sent
        ? `Sent · ${channel ?? "unknown"}${deliveryStatus ? ` · ${deliveryStatus}` : ""}${sentAt ? ` · ${formatDate(sentAt)}` : ""}`
        : "Not sent"}
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
