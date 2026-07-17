import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchRateLimitSettings } from "@/lib/bff";
import { RateLimitSettingsForm } from "@/components/RateLimitSettingsForm";

export default async function RateLimitSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchRateLimitSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Rate limits</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px" }}>
          Caps how many times a logged-in user can publish a listing or record a view within a
          rolling time window. Anonymous traffic is never rate-limited.
        </p>
        <RateLimitSettingsForm initial={settings} />
      </div>
    </div>
  );
}
