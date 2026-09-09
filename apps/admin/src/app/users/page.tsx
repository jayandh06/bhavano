import Link from "next/link";
import type { UserRole } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminUserSort, fetchUsers } from "@/lib/bff";
import { PAGE_SIZE_OPTIONS, buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { UsersTable } from "@/components/UsersTable";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Pagination } from "@/components/Pagination";

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

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const q = str(sp.q);
  const role = str(sp.role) as UserRole | undefined;
  const welcomed = str(sp.welcomed) as "yes" | "no" | undefined;
  const from = str(sp.from);
  const to = str(sp.to);
  const sort = str(sp.sort) as AdminUserSort | undefined;

  const result = await fetchUsers(accessToken, {
    offset: (currentPage - 1) * limit,
    q,
    role,
    welcomed,
    from,
    to,
    sort,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Users</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          {result.total.toLocaleString()} match the current filters. "Welcomed" reflects an actual
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

          <Field label="Per page">
            <AutoSubmitSelect
              name="limit"
              defaultValue={String(limit)}
              style={selectStyle}
              options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </Field>

          <button type="submit" style={applyButtonStyle}>
            Apply filters
          </button>
          <Link href="/users" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No users match these filters.</p>
        ) : (
          <UsersTable users={result.items} />
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} buildHref={(p) => buildPageHref("/users", sp, p)} />
      </div>
    </div>
  );
}

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
