"use client";

import type { ListingCategory, ListingPerformanceRowDto, TransactionType } from "@bhavano/types";
import { buildListingPath } from "@bhavano/types/listingPath";
import { formatDate } from "@/lib/formatDateTime";

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

const SITE_URL = "https://www.bhavano.com";

/**
 * The listing-performance table body — a client component for one reason: clicking a row opens
 * the live listing in a new tab. A plain `onClick` on the `<tr>` (`window.open`, not a real
 * anchor), same choice AdminListingsTable's own doc comment settled on for whole-row navigation —
 * the `position: relative`-`<tr>` + `position: absolute; inset: 0` stretched-anchor trick that
 * would keep real anchor semantics (ctrl/cmd-click, middle-click, "copy link") doesn't reliably
 * establish a containing block on a table row across mobile browsers, so it was dropped there
 * after tapping a row on mobile didn't navigate at all. `.admin-table-row` (globals.css) adds the
 * hover highlight and pointer cursor that normally comes free with a real link.
 */
export function ListingPerformanceTable({ items }: { items: ListingPerformanceRowDto[] }) {
  if (items.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={14} style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)" }}>
            No listings match the current filters.
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {items.map((item) => {
        const href = `${SITE_URL}${buildListingPath(item)}`;
        return (
          <tr
            key={item.id}
            className="admin-table-row"
            onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
            style={{ borderBottom: "1px solid var(--border)" }}
          >
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
            {/* Zero-enquiry rendering per the plan's "Edge cases" section: "0 of 0" reads as
                "owner never replies," which is wrong when there was nothing to reply to — so a
                dash instead, for messages/senders/reply-rate alike. */}
            <td style={tdStyle}>{item.enquiryCount === 0 ? "—" : item.totalMessages.toLocaleString()}</td>
            <td style={tdStyle}>{item.enquiryCount === 0 ? "—" : item.uniqueMessageSenders.toLocaleString()}</td>
            <td style={tdStyle}>{item.enquiryCount === 0 ? "—" : `${item.repliedThreads} of ${item.enquiryCount}`}</td>
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
        );
      })}
    </tbody>
  );
}

const tdStyle: React.CSSProperties = { padding: "10px 12px", whiteSpace: "nowrap" };
