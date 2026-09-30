import { requireAdmin } from "@/lib/requireAdmin";
import { fetchLoginNudgeSettings } from "@/lib/bff";
import { LoginNudgeSettingsForm } from "@/components/LoginNudgeSettingsForm";

import { FullPageLink } from "@/components/FullPageLink";
export default async function LoginNudgeSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchLoginNudgeSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Login prompt on listings</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 760 }}>
          Asks logged-out visitors to log in when they open a listing, so owners can see who viewed
          their ad. The listing itself always stays visible to everyone, Google included, and every
          prompt can be skipped. On the website the prompt never appears on the first listing of a
          visit, which keeps search rankings and Google Ads landing pages safe.
        </p>
        <LoginNudgeSettingsForm initial={settings} />
      </div>
    </div>
  );
}
