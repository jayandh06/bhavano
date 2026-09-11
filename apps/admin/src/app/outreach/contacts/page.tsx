import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchOutreachContacts, fetchOutreachContactCategories } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str } from "@/lib/searchParams";
import { OutreachContactsList } from "@/components/OutreachContactsList";
import { Pagination } from "@/components/Pagination";

export default async function OutreachContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const search = str(sp.search);
  const status = str(sp.status);
  const businessCategory = str(sp.businessCategory);
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const [result, categories] = await Promise.all([
    fetchOutreachContacts(accessToken, {
      offset: (currentPage - 1) * limit,
      limit,
      search,
      status,
      businessCategory,
    }),
    fetchOutreachContactCategories(accessToken),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Outreach contacts</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          Prospects pulled from Google Maps, scrapes and CSV uploads — separate from real Bhavano
          users. Opting someone out here also adds them to the suppression list, so a later import
          can&apos;t resurrect them.{" "}
          <Link href="/outreach/campaigns" style={{ color: "var(--green)", fontWeight: 700 }}>
            Campaigns →
          </Link>
        </p>

        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search name, phone or email"
            style={{
              flex: 1,
              minWidth: 220,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
            }}
          />
          <select
            name="businessCategory"
            defaultValue={businessCategory ?? ""}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--green)",
              color: "var(--on-green, #fff)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          {result.total} contact{result.total === 1 ? "" : "s"}
        </p>

        <OutreachContactsList contacts={result.items} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/outreach/contacts", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
