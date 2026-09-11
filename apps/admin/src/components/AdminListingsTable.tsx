import Link from "next/link";
import type { ListingDetailDto, ListingSource } from "@bhavano/types";
import { formatDate } from "@/lib/formatDateTime";

/** The dashboard's listing moderation queue as an actual table — was previously a card list
 * with no view/like/message counts visible at all. Plain server component, no interactivity:
 * a whole row is still clickable via a stretched-link (`<Link>` positioned to cover the title
 * `<td>`'s row via `inset: 0` on a `position: relative` `<tr>`) rather than a client-side
 * onClick, so this never needs "use client". */

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

export function AdminListingsTable({ items }: { items: ListingDetailDto[] }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
            {["Title", "Status", "Source", "Notification", "Views", "Likes", "Messages", "Price", "Created", "Modified"].map(
              (h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ),
            )}
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
                <StatusBadge moderationState={item.moderationState} adminReviewed={item.adminReviewed} />
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <SourceBadge source={item.source} />
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
