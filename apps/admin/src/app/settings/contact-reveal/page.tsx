import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchContactRevealSettings } from "@/lib/bff";
import { ContactRevealSettingsForm } from "@/components/ContactRevealSettingsForm";

export default async function ContactRevealSettingsPage() {
  const { accessToken } = await requireAdmin();
  const settings = await fetchContactRevealSettings(accessToken);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Contact reveal</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px" }}>
          Controls how many of a listing's owner contact details a user can unlock for free
          before needing to buy credits, and the price/size/expiry of a credit pack.
        </p>
        <ContactRevealSettingsForm initial={settings} />
      </div>
    </div>
  );
}
