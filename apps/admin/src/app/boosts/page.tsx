import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchBoosts } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { RevokeBoostButton } from "@/components/RevokeBoostButton";
import { formatDate } from "@/lib/formatDateTime";

export default async function BoostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const result = await fetchBoosts(accessToken, { offset: (currentPage - 1) * limit, limit });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Listing boosts</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
          Every purchased boost, newest first. Revoking clears the boost immediately (support/refund
          cases) without touching the payment record itself.
        </p>

        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px" }}>
          {result.total.toLocaleString()} boost{result.total === 1 ? "" : "s"}
        </p>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No boosts purchased yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.items.map((boost) => {
              const isActive = new Date(boost.boostedUntil).getTime() > Date.now();
              return (
                <div
                  key={boost.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 14,
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{boost.listingTitle}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isActive ? "var(--green)" : "var(--muted)",
                          border: `1px solid ${isActive ? "var(--green)" : "var(--border)"}`,
                          borderRadius: 6,
                          padding: "2px 8px",
                        }}
                      >
                        {isActive ? "Active" : "Expired"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                      {boost.ownerName ?? "Unknown owner"} · ₹{(boost.amount / 100).toLocaleString("en-IN")} ·{" "}
                      {formatDate(boost.boostedFrom)} → {formatDate(boost.boostedUntil)}
                    </div>
                  </div>
                  {isActive && <RevokeBoostButton listingId={boost.listingId} />}
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/boosts", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
