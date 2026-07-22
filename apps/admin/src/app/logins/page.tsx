import Link from "next/link";
import type { LoginMethod } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminLoginSort, fetchRecentLogins } from "@/lib/bff";
import { str } from "@/lib/searchParams";
import { UserPicker } from "@/components/UserPicker";

type SearchParams = Record<string, string | string[] | undefined>;

const METHOD_OPTIONS: { value: LoginMethod; label: string }[] = [
  { value: "otp", label: "OTP" },
  { value: "google", label: "Google" },
];

const SORT_OPTIONS: { value: AdminLoginSort; label: string }[] = [
  { value: "createdAt_desc", label: "Newest first" },
  { value: "createdAt_asc", label: "Oldest first" },
];

/** Carries every active filter forward alongside a new cursor — without this, "Load more"
 * would silently drop whatever filters are currently applied. */
function loadMoreHref(sp: SearchParams, nextCursor: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("cursor", nextCursor);
  return `/logins?${params.toString()}`;
}

export default async function LoginsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const cursor = str(sp.cursor);
  const userId = str(sp.userId);
  const userLabel = str(sp.userLabel);
  const from = str(sp.from);
  const to = str(sp.to);
  const method = str(sp.method) as LoginMethod | undefined;
  const sort = str(sp.sort) as AdminLoginSort | undefined;

  const page = await fetchRecentLogins(accessToken, { cursor, from, to, userId, method, sort, limit: 50 });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px" }}>Recent logins</h1>

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
          <Field label="User">
            <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
          </Field>

          <Field label="Method">
            <select name="method" defaultValue={method ?? ""} style={selectStyle}>
              <option value="">Any method</option>
              {METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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

          <Field label="From">
            <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
          </Field>
          <Field label="To">
            <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
          </Field>

          <button type="submit" style={applyButtonStyle}>
            Apply filters
          </button>
          <Link href="/logins" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reset
          </Link>
        </form>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "9px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

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
