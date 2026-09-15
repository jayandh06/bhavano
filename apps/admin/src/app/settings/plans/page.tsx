import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchBoostPricingSettings, fetchInstantAlertsPricingSettings, fetchSubscriptionPlanSettings } from "@/lib/bff";
import { BoostPricingSettingsForm } from "@/components/BoostPricingSettingsForm";
import { SubscriptionPlanSettingsForm } from "@/components/SubscriptionPlanSettingsForm";
import { InstantAlertsPricingSettingsForm } from "@/components/InstantAlertsPricingSettingsForm";

export default async function PlansSettingsPage() {
  const { accessToken } = await requireAdmin();
  const [boostPricing, subscriptionPlans, instantAlertsPricing] = await Promise.all([
    fetchBoostPricingSettings(accessToken),
    fetchSubscriptionPlanSettings(accessToken),
    fetchInstantAlertsPricingSettings(accessToken),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Plans</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px" }}>
          Boost prices, Instant Alerts pricing, and subscription tiers (Bhavano Plus, Agent/Broker
          Pro, Seller slot pack) including listing-slot counts. Changes take effect immediately —
          the boost picker, the Instant Alerts modal, the Bhavano Plus subscribe button, and the
          plan comparison page all read these live, and checkout charges exactly what's saved here.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 720 }}>
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Boost prices</h2>
            <BoostPricingSettingsForm initial={boostPricing} />
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Instant Alerts price</h2>
            <InstantAlertsPricingSettingsForm initial={instantAlertsPricing} />
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Subscription plans &amp; listing slots</h2>
            <SubscriptionPlanSettingsForm initial={subscriptionPlans} />
          </section>

          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
              background: "var(--surface)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Contact reveal credits</div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
              Free reveals, credit pack size/price, and expiry — managed on its own page.
            </p>
            <Link href="/settings/contact-reveal" style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
              Manage contact reveal settings →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
