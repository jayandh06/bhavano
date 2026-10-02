import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminReferralUserDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchReferral } from "@/lib/bff";
import { formatDate, formatDateTime } from "@/lib/formatDateTime";
import {
  ADMIN_ACTION_LABELS,
  REFERRAL_STATUS_COLORS,
  REFERRAL_STATUS_LABELS,
  creditStateLabel,
  skipReasonLabel,
} from "@/lib/referralLabels";
import { ReferralReviewPanel } from "@/components/ReferralReviewPanel";

const box = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
  background: "var(--surface)",
  marginBottom: 20,
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13.5, padding: "4px 0" }}>
      <div style={{ width: 180, color: "var(--muted)", flexShrink: 0 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function UserLink({ user }: { user: AdminReferralUserDto }) {
  return (
    <>
      <Link href={`/users/${user.id}`} style={{ fontWeight: 700 }}>
        {user.name || "Unnamed"}
      </Link>
      {user.phone && <span style={{ color: "var(--muted)" }}> · {user.phone}</span>}
    </>
  );
}

export default async function ReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await requireAdmin();
  const { id } = await params;

  const referral = await fetchReferral(accessToken, id).catch(() => null);
  if (!referral) notFound();

  const now = new Date().getTime();
  const credit = referral.credit;
  const creditState = creditStateLabel(credit, now);
  const frozen = referral.referrer.referralFrozenAt !== null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/referrals" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to referrals
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px" }}>
          Referral ·{" "}
          <span style={{ color: REFERRAL_STATUS_COLORS[referral.status] }}>{REFERRAL_STATUS_LABELS[referral.status]}</span>
        </h1>

        <div style={box}>
          <Row label="Referrer">
            <UserLink user={referral.referrer} />
            {frozen && (
              <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 2 }}>
                Frozen {formatDate(referral.referrer.referralFrozenAt!)}
                {referral.referrer.referralFrozenReason ? ` — ${referral.referrer.referralFrozenReason}` : ""}
              </div>
            )}
          </Row>
          <Row label="Referred user">
            <UserLink user={referral.referred} />
          </Row>
          <Row label="Link clicked">{referral.clickedAt ? formatDateTime(referral.clickedAt) : "—"}</Row>
          <Row label="Signed up">{formatDateTime(referral.signedUpAt)}</Row>
          <Row label="First ad approved">
            {referral.firstAdApprovedAt ? formatDateTime(referral.firstAdApprovedAt) : "Not yet"}
          </Row>
          {referral.rewardSkippedReason && (
            <Row label="Why no credit">{skipReasonLabel(referral.rewardSkippedReason)}</Row>
          )}
          <Row label="Credit">
            {credit ? (
              <>
                {creditState} · granted {formatDate(credit.grantedAt)} · expires {formatDate(credit.expiresAt)}
                {credit.redeemedAt && ` · used ${formatDate(credit.redeemedAt)}`}
                {credit.revokedAt && ` · revoked ${formatDate(credit.revokedAt)} (${credit.revokedReason ?? "no reason"})`}
              </>
            ) : (
              "None"
            )}
          </Row>
        </div>

        <ReferralReviewPanel
          referralId={referral.id}
          status={referral.status}
          referrerId={referral.referrer.id}
          referrerFrozen={frozen}
          creditUnused={creditState === "Available"}
        />

        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Referrer</div>
          <Row label="Referrals made">
            <Link href={`/referrals?referrerId=${referral.referrer.id}`}>{referral.referrerStats.referralsTotal}</Link>
          </Row>
          <Row label="Credits this month">{referral.referrerStats.creditsThisMonth}</Row>
          <Row label="Credits available now">{referral.referrerStats.availableCredits}</Row>
          <Row label="Live approved ads">{referral.referrerStats.approvedAds}</Row>
          <Row label="Their link was opened">{referral.referrerStats.linkOpens} times</Row>
          <Row label="They tapped Share">{referral.referrerStats.shareTaps} times</Row>
        </div>

        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Admin actions</div>
          {referral.actions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>None yet.</p>
          ) : (
            referral.actions.map((a) => (
              <div key={a.id} style={{ fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                <strong>{ADMIN_ACTION_LABELS[a.action] ?? a.action}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {" "}
                  · {a.adminName ?? "Admin"} · {formatDateTime(a.createdAt)}
                </span>
                {a.note && <div style={{ color: "var(--text-soft)" }}>{a.note}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
