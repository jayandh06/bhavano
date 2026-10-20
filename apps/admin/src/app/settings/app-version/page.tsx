import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAppVersionSettings } from "@/lib/bff";
import { AppVersionSettingsForm } from "@/components/AppVersionSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function AppVersionSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchAppVersionSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Required app update</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 760 }}>
          Sets the oldest app version still allowed on each platform. A phone running something older sees a
          full-screen &ldquo;Update required&rdquo; page with a button to the store, and can&rsquo;t use the app until it
          updates. Leave a box empty for no minimum.
        </p>
        <AppVersionSettingsForm initial={settings} />
      </div>
    </div>
  );
}
