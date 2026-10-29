import { requireAdmin } from "@/lib/requireAdmin";
import { fetchSeekerContactSettings } from "@/lib/bff";
import { SeekerContactSettingsForm } from "@/components/SeekerContactSettingsForm";
import { FullPageLink } from "@/components/FullPageLink";

export default async function SeekerContactSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchSeekerContactSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          &larr; Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Seeker contact</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          Lets an ad owner see the phone number of people who showed interest in their ad: free while the ad is Featured (or the owner has Agent Pro), otherwise one lead at a
          time for a contact-reveal credit. Off by default. Update the privacy policy before turning it on. See docs/plans/featured-seeker-contact-for-owners.md.
        </p>
        <SeekerContactSettingsForm initial={settings} />
      </div>
    </div>
  );
}
