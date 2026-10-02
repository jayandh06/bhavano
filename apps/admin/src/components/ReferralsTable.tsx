import Link from "next/link";
import type { AdminReferralDto, AdminReferralUserDto } from "@bhavano/types";
import { formatDate } from "@/lib/formatDateTime";
import {
  REFERRAL_STATUS_COLORS,
  REFERRAL_STATUS_LABELS,
  creditStateLabel,
  skipReasonLabel,
} from "@/lib/referralLabels";

const th = { textAlign: "left", padding: "10px 12px", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 } as const;
const td = { padding: "10px 12px", fontSize: 13, verticalAlign: "top" } as const;

function UserCell({ user, frozen }: { user: AdminReferralUserDto; frozen?: boolean }) {
  return (
    <div>
      <Link href={`/users/${user.id}`} style={{ fontWeight: 700 }}>
        {user.name || "Unnamed"}
      </Link>
      {frozen && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--danger)", fontWeight: 700 }}>FROZEN</span>}
      {user.phone && <div style={{ fontSize: 12, color: "var(--muted)" }}>{user.phone}</div>}
    </div>
  );
}

export function ReferralsTable({ items, now }: { items: AdminReferralDto[]; now: number }) {
  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--muted)" }}>No referrals match this filter.</p>;
  }
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={th}>Signed up</th>
            <th style={th}>Referrer</th>
            <th style={th}>Referred user</th>
            <th style={th}>Status</th>
            <th style={th}>First ad approved</th>
            <th style={th}>Credit</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}>{formatDate(r.signedUpAt)}</td>
              <td style={td}>
                <UserCell user={r.referrer} frozen={r.referrer.referralFrozenAt !== null} />
              </td>
              <td style={td}>
                <UserCell user={r.referred} />
              </td>
              <td style={td}>
                <span style={{ fontWeight: 700, color: REFERRAL_STATUS_COLORS[r.status] }}>
                  {REFERRAL_STATUS_LABELS[r.status]}
                </span>
                {r.rewardSkippedReason && (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{skipReasonLabel(r.rewardSkippedReason)}</div>
                )}
              </td>
              <td style={td}>{r.firstAdApprovedAt ? formatDate(r.firstAdApprovedAt) : "—"}</td>
              <td style={td}>{creditStateLabel(r.credit, now)}</td>
              <td style={td}>
                <Link href={`/referrals/${r.id}`} style={{ fontWeight: 700 }}>
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
