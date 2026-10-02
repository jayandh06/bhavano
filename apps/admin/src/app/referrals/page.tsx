import Link from "next/link";
import type { ReferralFunnelDto, ReferralStatus } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchReferralFunnel, fetchReferrals } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { ReferralsTable } from "@/components/ReferralsTable";
import { skipReasonLabel } from "@/lib/referralLabels";

type View = "any" | "flagged" | "frozen" | Exclude<ReferralStatus, "blocked">;

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "any", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "signed_up", label: "Awaiting first ad" },
  { value: "ad_approved", label: "Ad approved, no credit" },
  { value: "rewarded", label: "Rewarded" },
  { value: "reversed", label: "Reversed" },
  { value: "frozen", label: "Frozen referrers" },
];

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];

function pillStyle(active: boolean) {
  return {
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${active ? "var(--green)" : "var(--border)"}`,
    color: active ? "var(--green)" : "var(--text-soft)",
    background: active ? "var(--surface-alt)" : "var(--surface)",
  } as const;
}

function hrefWith(sp: SearchParams, changes: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = str(value);
    if (v && key !== "page") params.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) params.set(key, value);
  return `/referrals?${params.toString()}`;
}

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const view = (VIEW_OPTIONS.find((o) => o.value === str(sp.view))?.value ?? "any") as View;
  const daysParam = DAY_OPTIONS.some((o) => o.value === str(sp.days)) ? str(sp.days)! : "30";
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const [result, funnel] = await Promise.all([
    fetchReferrals(accessToken, {
      status: view === "flagged" ? "blocked" : view === "any" || view === "frozen" ? undefined : view,
      frozen: view === "frozen",
      referrerId: str(sp.referrerId),
      offset: (currentPage - 1) * limit,
      limit,
    }),
    fetchReferralFunnel(accessToken, daysParam === "all" ? undefined : Number(daysParam)),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  const now = new Date().getTime();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Referrals</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px", maxWidth: 720 }}>
          Who referred whom, and whether the referrer earned a boost credit.{" "}
          <strong>{result.flaggedTotal}</strong> flagged for review. Reward rules are on the{" "}
          <Link href="/settings/referrals" style={{ fontWeight: 700 }}>
            referral rewards
          </Link>{" "}
          settings page.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {DAY_OPTIONS.map((option) => (
            <Link key={option.value} href={hrefWith(sp, { days: option.value })} style={pillStyle(daysParam === option.value)}>
              {option.label}
            </Link>
          ))}
        </div>
        <FunnelCards funnel={funnel} />

        <div style={{ display: "flex", gap: 8, margin: "24px 0 20px", flexWrap: "wrap" }}>
          {VIEW_OPTIONS.map((option) => (
            <Link key={option.value} href={hrefWith(sp, { view: option.value })} style={pillStyle(view === option.value)}>
              {option.label}
              {option.value === "flagged" && result.flaggedTotal > 0 ? ` (${result.flaggedTotal})` : ""}
            </Link>
          ))}
        </div>

        <ReferralsTable items={result.items} now={now} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/referrals", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}

function FunnelCards({ funnel }: { funnel: ReferralFunnelDto }) {
  const steps: { label: string; value: number }[] = [
    { label: "Link clicks", value: funnel.clicks },
    { label: "Signups", value: funnel.signups },
    { label: "First ad approved", value: funnel.firstAdApproved },
    { label: "Credits granted", value: funnel.rewarded },
    { label: "Credits used", value: funnel.creditsRedeemed },
  ];
  const side: { label: string; value: number }[] = [
    { label: "Flagged", value: funnel.flagged },
    { label: "Reversed", value: funnel.reversed },
    { label: "Credits revoked", value: funnel.creditsRevoked },
    { label: "Credits expired unused", value: funnel.creditsExpired },
  ];
  const skipped = Object.entries(funnel.skippedByReason).sort((a, b) => b[1] - a[1]);

  const card = (s: { label: string; value: number }, muted = false) => (
    <div
      key={s.label}
      style={{
        flex: "1 1 140px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        background: "var(--surface)",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{s.label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: muted ? "var(--text-soft)" : "var(--text)" }}>{s.value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{steps.map((s) => card(s))}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{side.map((s) => card(s, true))}</div>
      {skipped.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
          No credit given:{" "}
          {skipped.map(([reason, count], i) => (
            <span key={reason}>
              {i > 0 ? " · " : ""}
              {skipReasonLabel(reason)} <strong>{count}</strong>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
