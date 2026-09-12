import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchDiscountCodes } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { CreateDiscountCodeForm } from "@/components/CreateDiscountCodeForm";
import { DiscountCodesTable } from "@/components/DiscountCodesTable";

export default async function DiscountCodesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const result = await fetchDiscountCodes(accessToken, { offset: (currentPage - 1) * limit, limit });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Discount codes</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          Redeemable across every paid product — contact-reveal credits, listing boosts, Bhavano
          Plus, Agent Pro, and seller slot packs. {result.total.toLocaleString()} code
          {result.total === 1 ? "" : "s"} total.
        </p>

        <CreateDiscountCodeForm />

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No discount codes yet.</p>
        ) : (
          <DiscountCodesTable items={result.items} />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/discount-codes", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
