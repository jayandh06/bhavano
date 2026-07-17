import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchRecentLogins } from "@/lib/bff";

export default async function LoginsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  const page = await fetchRecentLogins(accessToken, { cursor, limit: 50 });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px" }}>Recent logins</h1>

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No logins recorded yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {page.items.map((login) => (
              <Link
                key={login.id}
                href={`/users/${login.userId}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--surface)",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {login.userName ?? login.userPhone ?? login.userEmail ?? "Unknown user"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {[login.userPhone, login.userEmail].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>{login.method}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(login.createdAt).toLocaleString()}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {page.nextCursor && (
          <Link
            href={`/logins?cursor=${page.nextCursor}`}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--green)" }}
          >
            Load more →
          </Link>
        )}
      </div>
    </div>
  );
}
