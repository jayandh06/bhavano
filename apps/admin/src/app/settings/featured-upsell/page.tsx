import { requireAdmin } from "@/lib/requireAdmin";
import { fetchFeaturedUpsellSettings } from "@/lib/bff";
import { FeaturedUpsellSettingsForm } from "@/components/FeaturedUpsellSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function FeaturedUpsellSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchFeaturedUpsellSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          &larr; Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Featured prompt</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          Offers Featured to an owner who opens My listings (or their own listing page) with a live ad that is not Featured. Once per session, quiet for a few days after
          &ldquo;Not now&rdquo;, and never more than a set number of times per ad. Off by default. See docs/plans/featured-upsell-prompt.md.
        </p>
        <FeaturedUpsellSettingsForm initial={settings} />
      </div>
    </div>
  );
}
