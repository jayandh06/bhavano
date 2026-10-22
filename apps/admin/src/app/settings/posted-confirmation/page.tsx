import { requireAdmin } from "@/lib/requireAdmin";
import { fetchPostedConfirmationSettings } from "@/lib/bff";
import { PostedConfirmationSettingsForm } from "@/components/PostedConfirmationSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function PostedConfirmationSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchPostedConfirmationSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Posted confirmation</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          When a seller posts an ad, the &quot;your ad is posted&quot; email or WhatsApp is held back so they
          see the Featured offer first. It is sent as soon as they reach the &quot;Your ad is live!&quot; screen
          (Featured bought, skipped, or the payment window closed). This is how long to wait before
          sending it anyway, for sellers who close the page without getting there. The same wait can
          also keep the ad itself off the site, below. See docs/plans/post-ad-acknowledgement.md and
          docs/plans/scheduled-go-live.md.
        </p>
        <PostedConfirmationSettingsForm initial={settings} />
      </div>
    </div>
  );
}
