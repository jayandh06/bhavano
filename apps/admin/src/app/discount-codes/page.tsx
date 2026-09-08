import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchDiscountCodes } from "@/lib/bff";
import { CreateDiscountCodeForm } from "@/components/CreateDiscountCodeForm";
import { DiscountCodesTable } from "@/components/DiscountCodesTable";

export default async function DiscountCodesPage() {
  const { accessToken } = await requireAdmin();
  const page = await fetchDiscountCodes(accessToken, { limit: 100 });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Discount codes</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          Redeemable across every paid product — contact-reveal credits, listing boosts, Bhavano
          Plus, Agent Pro, and seller slot packs. {page.total.toLocaleString()} code
          {page.total === 1 ? "" : "s"} total.
        </p>

        <CreateDiscountCodeForm />

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No discount codes yet.</p>
        ) : (
          <DiscountCodesTable items={page.items} />
        )}
      </div>
    </div>
  );
}
