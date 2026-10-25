import Link from "next/link";
import type { AdminPaymentDto, PaymentPurpose, PaymentStatus } from "@bhavano/types";
import { PURCHASE_SOURCE_LABELS, parsePurchaseSource } from "@bhavano/types/purchaseSource";
import { formatDateTime } from "@/lib/formatDateTime";

const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  listing_boost: "Feature",
  listing_publish: "Publish listing",
  buyer_premium: "Bhavano Plus",
  agent_pro: "Agent/Broker Pro",
  seller_slot_pack: "Seller Slot Pack",
  contact_reveal_credits: "Contact Reveal Credits",
  instant_alerts: "Instant Alerts",
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  created: "Started, not paid",
  failed: "Failed",
  refunded: "Refunded",
};

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: "var(--green)",
  created: "var(--gold, #b8860b)",
  failed: "#c0554b",
  refunded: "var(--muted)",
};

/** What this person (or this listing) has bought, newest first: the same rows as the Payments screen, shown where an
 * admin is already looking. Paid, failed and abandoned checkouts all appear, so "did he try and fail, or never try?"
 * has an answer. The date is when the checkout started; "Paid" is when the money arrived. `showPerson` is for the
 * listing page, where the buyer is the question. */
export function PurchasesPanel({
  items,
  total,
  seeAllHref,
  showPerson = false,
  showListing = false,
}: {
  items: AdminPaymentDto[];
  total: number;
  seeAllHref: string;
  showPerson?: boolean;
  showListing?: boolean;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
        Purchases ({total}){" "}
        <Link href={seeAllHref} style={{ color: "var(--green)", fontSize: 12.5, fontWeight: 700, marginLeft: 8 }}>
          Open in Payments &rarr;
        </Link>
      </div>
      {items.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Nothing bought yet, and no checkout started.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                {["Started", "What", ...(showListing ? ["Listing"] : []), ...(showPerson ? ["Buyer"] : []), "Amount", "Status", "Paid", "From"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const known = parsePurchaseSource(p.source);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDateTime(p.createdAt)}</td>
                    <td style={td}>
                      {PURPOSE_LABELS[p.purpose]}
                      {p.boostDays ? ` (${p.boostDays} days)` : ""}
                      {p.discountCode ? <div style={{ fontSize: 11, color: "var(--muted)" }}>code {p.discountCode}</div> : null}
                    </td>
                    {showListing && (
                      <td style={{ ...td, maxWidth: 240 }}>
                        {p.listingId ? (
                          <Link href={`/listings/${p.listingId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                            {p.listingTitle ?? "Listing"}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    )}
                    {showPerson && (
                      <td style={td}>
                        <Link href={`/users/${p.userId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                          {p.userName ?? p.userPhone ?? p.userEmail ?? "User"}
                        </Link>
                      </td>
                    )}
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {(p.amount / 100).toLocaleString("en-IN", { style: "currency", currency: p.currency, maximumFractionDigits: 2 })}
                    </td>
                    <td style={td}>
                      <span style={{ color: STATUS_COLORS[p.status], fontWeight: 700 }}>{STATUS_LABELS[p.status]}</span>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{p.paidAt ? formatDateTime(p.paidAt) : "—"}</td>
                    <td style={td}>{known ? PURCHASE_SOURCE_LABELS[known] : p.source ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: "7px 10px", verticalAlign: "top" };
