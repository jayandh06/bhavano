import Link from "next/link";
import type { ModerationState } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAdminListings } from "@/lib/bff";
import { signOutAction } from "@/app/actions/auth";

type FilterTab = "needsReview" | "flagged" | "all";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "needsReview", label: "Needs review" },
  { value: "flagged", label: "Flagged" },
  { value: "all", label: "All listings" },
];

function tabToQuery(tab: FilterTab): { moderationState?: ModerationState; adminReviewed?: boolean } {
  if (tab === "needsReview") return { adminReviewed: false };
  if (tab === "flagged") return { moderationState: "flagged" };
  return {};
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : "needsReview";
  const tab: FilterTab = TABS.some((t) => t.value === tabParam) ? (tabParam as FilterTab) : "needsReview";

  const page = await fetchAdminListings(accessToken, { ...tabToQuery(tab), limit: 50 });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Listing moderation</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/logins" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-soft)" }}>
              Recent logins
            </Link>
            <Link href="/settings/rate-limits" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-soft)" }}>
              Rate limits
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 700 }}
              >
                Logout
              </button>
            </form>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/?tab=${t.value}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${tab === t.value ? "var(--green)" : "var(--border)"}`,
                color: tab === t.value ? "var(--green)" : "var(--text-soft)",
                background: tab === t.value ? "var(--surface-alt)" : "var(--surface)",
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing here.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {page.items.map((item) => (
              <Link
                key={item.id}
                href={`/listings/${item.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                  background: "var(--surface)",
                  color: "inherit",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</span>
                    <StatusBadge moderationState={item.moderationState} adminReviewed={item.adminReviewed} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                    {item.price} · {item.category} · {item.area}, {item.cityName}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ moderationState, adminReviewed }: { moderationState: string; adminReviewed: boolean }) {
  const label = moderationState === "flagged" ? "Flagged" : adminReviewed ? "Reviewed" : "Needs review";
  const color = moderationState === "flagged" ? "var(--danger)" : adminReviewed ? "var(--green)" : "var(--muted)";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 6, padding: "2px 8px" }}>
      {label}
    </span>
  );
}

