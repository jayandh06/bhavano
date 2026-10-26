import { requireAdmin } from "@/lib/requireAdmin";
import { fetchReminderSettings } from "@/lib/bff";
import { ReminderSettingsForm } from "@/components/ReminderSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function ReminderSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchReminderSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          &larr; Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Featured reminders</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          Two automatic in-app messages (with a push) from &ldquo;Bhavano Admin&rdquo;: one that nudges the owner of a new ad that is not Featured, and one that warns
          the owner before a Featured period ends, with a Renew button. See docs/plans/featured-expiry-reminder.md.
        </p>
        <ReminderSettingsForm initial={settings} />
      </div>
    </div>
  );
}
