import Link from "next/link";
import type { RequirementStatus } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchRequirements } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { RequirementsTable } from "@/components/RequirementsTable";

const STATUS_OPTIONS: { value: RequirementStatus | "any"; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "working", label: "Working" },
  { value: "closed", label: "Closed" },
  { value: "any", label: "All" },
];

/** Open-first by default: this queue only works if somebody reads it, and the default view should
 * be the work, not the archive. */
const DEFAULT_STATUS: RequirementStatus | "any" = "open";

export default async function RequirementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const statusParam = (str(sp.status) as RequirementStatus | "any" | undefined) ?? DEFAULT_STATUS;
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const result = await fetchRequirements(accessToken, {
    status: statusParam === "any" ? undefined : statusParam,
    offset: (currentPage - 1) * limit,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Requirements</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px", maxWidth: 720 }}>
          What people searched for and could not find. Each one is a lead and a gap in inventory:
          look for something close in the catalogue, call them, or use{" "}
          <Link href="/outreach/campaigns" style={{ fontWeight: 700 }}>
            outreach
          </Link>{" "}
          to recruit an owner in that area. <strong>{result.openTotal}</strong> open right now.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {STATUS_OPTIONS.map((option) => {
            const active = statusParam === option.value;
            return (
              <Link
                key={option.value}
                href={`/requirements?status=${option.value}`}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1px solid ${active ? "var(--green)" : "var(--border)"}`,
                  color: active ? "var(--green)" : "var(--text-soft)",
                  background: active ? "var(--surface-alt)" : "var(--surface)",
                }}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        <RequirementsTable items={result.items} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/requirements", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
