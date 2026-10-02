import { requireAdmin } from "@/lib/requireAdmin";
import { fetchReferralSettings } from "@/lib/bff";
import { ReferralSettingsForm } from "@/components/ReferralSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function ReferralSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchReferralSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/referrals" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to referrals
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Referral rewards</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 720 }}>
          A user earns one free boost credit when someone they referred gets their first ad approved.
          These settings control how long that boost runs, how long the credit stays usable, and the
          anti-abuse limits.
        </p>
        <ReferralSettingsForm initial={settings} />
      </div>
    </div>
  );
}
