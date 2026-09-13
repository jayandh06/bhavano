"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClaimSource, ListingDetailDto, ListingSource, ListingStatus, SendPostedNotificationResponseDto } from "@bhavano/types";
import { sendPostedNotificationAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/formatDateTime";
import { str, type SearchParams } from "@/lib/searchParams";

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
 * UsersTable's identical pattern for welcome emails) — sortable headers stay a full-page `<Link>`
 * regardless, since the server needs the real order for pagination anyway. */

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

export function AdminListingsTable({ items, sp }: { items: ListingDetailDto[]; sp: SearchParams }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Only listings that haven't already gotten the "your ad is live" acknowledgement are
  // selectable — the whole point of this action is filling that gap, not a deliberate resend
  // (see AdminService.sendPostedNotification's own doc comment on that distinction).
  const eligible = items.filter((item) => item.postedNotificationSent === false);
  const eligibleIds = new Set(eligible.map((item) => item.id));
  const allSelected = eligible.length > 0 && eligible.every((item) => selected.has(item.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(eligibleIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSend() {
    const listingIds = Array.from(selected);
    if (listingIds.length === 0) return;
    setPending(true);
    setSummary(null);

    const result: SendPostedNotificationResponseDto | { success: false; error: string } =
      await sendPostedNotificationAction(listingIds);
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
          <button onClick={onSend} disabled={pending} style={actionButtonStyle}>
            {pending ? "Sending…" : "Send notification"}
          </button>
        </div>
      )}

      {summary && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>{summary}</p>}

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
              <th style={thStyle}>
                {eligible.length > 0 && <input type="checkbox" checked={allSelected} onChange={toggleAll} />}
              </th>
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
              <tr
                key={item.id}
                className="admin-table-row"
                onClick={() => router.push(`/listings/${item.id}`)}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                  {eligibleIds.has(item.id) && (
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                  )}
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, maxWidth: 260 }}>{item.title}</td>
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
