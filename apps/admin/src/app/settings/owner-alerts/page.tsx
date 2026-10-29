import { requireAdmin } from "@/lib/requireAdmin";
import { fetchOwnerAlertSettings } from "@/lib/bff";
import { OwnerAlertSettingsForm } from "@/components/OwnerAlertSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function OwnerAlertSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchOwnerAlertSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          &larr; Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Owner alerts</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          How advertisers are told that someone messaged them or viewed their number. Each owner chooses their own first channel; this page decides whether the paid ones
          (WhatsApp, SMS) are used only for Featured ads or for every ad. See docs/plans/owner-notification-channel-preferences.md.
        </p>
        <OwnerAlertSettingsForm initial={settings} />
      </div>
    </div>
  );
}
