import { requireAdmin } from "@/lib/requireAdmin";
import { fetchSavedSearchSettings } from "@/lib/bff";
import { SavedSearchSettingsForm } from "@/components/SavedSearchSettingsForm";

import { FullPageLink } from "@/components/FullPageLink";
export default async function AlertSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchSavedSearchSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Search alerts</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          How many saved-search alerts a user gets without a Bhavano Plus subscription. Alerts were
          Plus-only on both creation and matching, which meant a built feature had never been used
          once — the free quota is what lets the empty-search prompt honestly promise to tell
          someone when a match appears. See docs/plans/property-requirements-demand-side.md.
        </p>
        <SavedSearchSettingsForm initial={settings} />
      </div>
    </div>
  );
}
