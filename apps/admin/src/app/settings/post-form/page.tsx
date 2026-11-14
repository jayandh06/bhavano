import { requireAdmin } from "@/lib/requireAdmin";
import { fetchPostFormSettings } from "@/lib/bff";
import { PostFormSettingsForm } from "@/components/PostFormSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function PostFormSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchPostFormSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Post ad form</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 760 }}>
          The redesigned Details step of the post-ad form puts the location search and the photos and video together near the top. It is shown to
          the share of visitors set here; everyone else keeps the original form. Each visitor stays in the same group. Admin accounts always
          see the new form, and their sessions are kept out of the comparison.
        </p>
        <PostFormSettingsForm initial={settings} />
      </div>
    </div>
  );
}
