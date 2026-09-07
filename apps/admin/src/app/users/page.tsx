import Link from "next/link";
import type { UserRole } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminUserSort, fetchUsers } from "@/lib/bff";
import { str } from "@/lib/searchParams";
import { formatDateTime } from "@/lib/formatDateTime";

type SearchParams = Record<string, string | string[] | undefined>;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];

const WELCOMED_OPTIONS: { value: "yes" | "no"; label: string }[] = [
  { value: "yes", label: "Welcomed" },
  { value: "no", label: "Not welcomed" },
];

const SORT_OPTIONS: { value: AdminUserSort; label: string }[] = [
  { value: "createdAt_desc", label: "Newest first" },
  { value: "createdAt_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name — A→Z" },
];

/** Carries every active filter forward alongside a new cursor. */
function loadMoreHref(sp: SearchParams, nextCursor: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("cursor", nextCursor);
  return `/users?${params.toString()}`;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const cursor = str(sp.cursor);
  const q = str(sp.q);
  const role = str(sp.role) as UserRole | undefined;
  const welcomed = str(sp.welcomed) as "yes" | "no" | undefined;
  const from = str(sp.from);
  const to = str(sp.to);
  const sort = str(sp.sort) as AdminUserSort | undefined;

  const page = await fetchUsers(accessToken, { cursor, q, role, welcomed, from, to, sort, limit: 50 });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Users</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          {page.total.toLocaleString()} match the current filters. "Welcomed" reflects an actual
          delivered welcome notification, not just an attempted one.
        </p>

        <form
          method="get"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
            marginBottom: 20,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <Field label="Search">
            <input name="q" defaultValue={q} placeholder="Name, phone or email" style={textInputStyle} />
          </Field>

          <Field label="Role">
            <select name="role" defaultValue={role ?? ""} style={selectStyle}>
              <option value="">Any role</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notification status">
            <select name="welcomed" defaultValue={welcomed ?? ""} style={selectStyle}>
              <option value="">Any status</option>
              {WELCOMED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="From">
            <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
          </Field>
          <Field label="To">
            <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
          </Field>

          <Field label="Sort by">
            <select name="sort" defaultValue={sort ?? "createdAt_desc"} style={selectStyle}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <button type="submit" style={applyButtonStyle}>
            Apply filters
          </button>
          <Link href="/users" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reset
          </Link>
        </form>

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No users match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  {["Created", "Name", "Phone", "Email", "Role", "City", "Notification status"].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.items.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(u.createdAt)}</td>
                    <td style={tdStyle}>
                      <Link href={`/users/${u.id}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                        {u.name ?? dash}
                      </Link>
                    </td>
                    <td style={tdStyle}>{u.phone ?? dash}</td>
                    <td style={tdStyle}>{u.email ?? dash}</td>
                    <td style={tdStyle}>{u.role}</td>
                    <td style={tdStyle}>{u.cityName ?? dash}</td>
                    <td style={tdStyle}>
                      {u.welcomed ? (
                        <span style={{ color: "var(--green)", fontWeight: 700 }}>
                          ✓ {u.welcomedChannel ?? "welcomed"}
                          {u.welcomedAt && (
                            <span style={{ color: "var(--muted)", fontWeight: 400 }}> — {formatDateTime(u.welcomedAt)}</span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: "var(--danger)", fontWeight: 700 }}>Not welcomed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page.nextCursor && (
          <Link
            href={loadMoreHref(sp, page.nextCursor)}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--green)" }}
          >
            Load more →
          </Link>
        )}
      </div>
    </div>
  );
}

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const textInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

const selectStyle: React.CSSProperties = { ...textInputStyle };

const dateInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
};

const applyButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
