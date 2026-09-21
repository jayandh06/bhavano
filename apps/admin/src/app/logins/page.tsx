import Link from "next/link";
import type { DeviceType, LoginMethod } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminLoginSort, AdminLoginSortField, fetchRecentLogins } from "@/lib/bff";
import {
  buildPageHref,
  buildSuffixSortHref,
  parsePage,
  parsePageSize,
  str,
  suffixSortDirectionFor,
  type SearchParams,
} from "@/lib/searchParams";
import { formatDateTime } from "@/lib/formatDateTime";
import { CLEAR_FILTERS_PARAM } from "@/lib/rememberedFilters";
import { UserPicker } from "@/components/UserPicker";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";
import { SortableHeader } from "@/components/SortableHeader";

/** What the BFF falls back to with no `?sort=` — named here so the Last login column's header
 * still shows its ▼ before anything has been clicked. */
const DEFAULT_SORT: AdminLoginSort = "lastLoginAt_desc";

const METHOD_LABELS: Record<LoginMethod, string> = {
  otp: "OTP",
  google: "Google",
  apple: "Apple",
};

const METHOD_OPTIONS: { value: LoginMethod; label: string }[] = [
  { value: "otp", label: "OTP" },
  { value: "google", label: "Google" },
  { value: "apple", label: "Apple" },
];

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

/** Kept as a plain `""`/`"true"`/`"false"` string in the URL (not a checkbox) — a three-state
 * filter (any/yes/no) needs a neutral "not filtering on this at all" option a checkbox can't
 * express. */
const YES_NO_OPTIONS = [
  { value: "", label: "Any" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export default async function LoginsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const userId = str(sp.userId);
  const userLabel = str(sp.userLabel);
  const from = str(sp.from);
  const to = str(sp.to);
  const search = str(sp.search);
  const method = str(sp.method) as LoginMethod | undefined;
  const isNewUserParam = str(sp.isNewUser);
  const hasPostedAdParam = str(sp.hasPostedAd);
  const sort = str(sp.sort) as AdminLoginSort | undefined;

  const result = await fetchRecentLogins(accessToken, {
    offset: (currentPage - 1) * limit,
    from,
    to,
    userId,
    search,
    method,
    isNewUser: isNewUserParam ? isNewUserParam === "true" : undefined,
    hasPostedAd: hasPostedAdParam ? hasPostedAdParam === "true" : undefined,
    sort,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  const sortHref = (field: AdminLoginSortField) => buildSuffixSortHref("/logins", sp, field, DEFAULT_SORT);
  const sortDir = (field: AdminLoginSortField) => suffixSortDirectionFor(sp, field, DEFAULT_SORT);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Recent logins</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          One row per user, not per login — their first-ever login, most recent login (and its
          method/device), and whether they&apos;ve posted an ad.
        </p>

        {/* Same split as the page-visits screen this mirrors: the four fields below don't map
            onto a single column the way the header filters do — a user lookup is an
            autocomplete, and the dates bound the range "last login" describes, not a column of
            its own. Sorting is the exception: those are plain links (SortableHeader), so
            clicking a column doesn't require pressing Apply. */}
        <form method="get">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
              marginBottom: 12,
              padding: 16,
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
            }}
          >
            <Field label="User">
              <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
            </Field>

            <Field label="From (last login)">
              <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
            </Field>
            <Field label="To (last login)">
              <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
            </Field>

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            {/* CLEAR_FILTERS_PARAM, not a bare "/logins" href: middleware.ts needs an explicit,
              * unambiguous "this is a reset" signal — see decideFilterAction's own comment for why
              * inferring it from Referer broke on the nav's own "you are here" tab. prefetch={false}
              * because a background prefetch of a link that clears filters shouldn't fire just from
              * it being visible, before anyone actually clicks it. */}
            <Link
              href={`/logins?${CLEAR_FILTERS_PARAM}=1`}
              prefetch={false}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}
            >
              Reset
            </Link>
          </div>

          {/* Carried so a header-filter submit doesn't silently drop the active sort (links set
              it, this preserves it) or the chosen page size. Page deliberately isn't carried —
              changing a filter should land back on page 1. */}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {str(sp.limit) && <input type="hidden" name="limit" value={str(sp.limit)} />}

          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  <th style={thStyle}>
                    <SortableHeader label="User" href={sortHref("userName")} direction={sortDir("userName")} />
                  </th>
                  <th style={thStyle}>New user</th>
                  <th style={thStyle}>
                    <SortableHeader label="First login" href={sortHref("firstLoginAt")} direction={sortDir("firstLoginAt")} />
                  </th>
                  <th style={thStyle}>
                    <SortableHeader label="Last login" href={sortHref("lastLoginAt")} direction={sortDir("lastLoginAt")} />
                  </th>
                  <th style={thStyle}>Login mode</th>
                  <th style={thStyle}>Device</th>
                  <th style={thStyle}>Has posted ad</th>
                </tr>
                {/* Filter row — one input per filterable column, directly under its own heading
                    rather than in a legend above the table. Enter submits (it's a real form), so
                    Apply above is for the User/date-range controls more than for these. */}
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={filterThStyle}>
                    <input name="search" defaultValue={search} placeholder="Name, phone, email" style={headerInputStyle} />
                  </th>
                  <th style={filterThStyle}>
                    <SelectField name="isNewUser" defaultValue={isNewUserParam ?? ""} style={headerSelectStyle}>
                      {YES_NO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectField>
                  </th>
                  <th style={filterThStyle} />
                  <th style={filterThStyle} />
                  <th style={filterThStyle}>
                    <SelectField name="method" defaultValue={method ?? ""} style={headerSelectStyle}>
                      <option value="">Any</option>
                      {METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectField>
                  </th>
                  <th style={filterThStyle} />
                  <th style={filterThStyle}>
                    <SelectField name="hasPostedAd" defaultValue={hasPostedAdParam ?? ""} style={headerSelectStyle}>
                      {YES_NO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectField>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.userId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>
                      <Link href={`/users/${row.userId}`} style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}>
                        {row.userName ?? row.userPhone ?? row.userEmail ?? "Unknown user"}
                      </Link>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                        {[row.userPhone, row.userEmail].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {row.isNewUser ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--gold, #b8860b)",
                            border: "1px solid var(--gold, #b8860b)",
                            borderRadius: 6,
                            padding: "2px 8px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          New user
                        </span>
                      ) : (
                        dash
                      )}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.firstLoginAt)}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.lastLoginAt)}</td>
                    <td style={tdStyle}>{METHOD_LABELS[row.lastLoginMethod]}</td>
                    {/* Only known for a web login with a session — see UserLoginSummaryDto.
                        lastLoginDevice's own doc comment for why a mobile-app login never has
                        one at all, which is why this reads "—" for plenty of real app users, not
                        just for missing data. */}
                    <td style={tdStyle}>{row.lastLoginDevice ? DEVICE_TYPE_LABELS[row.lastLoginDevice] : dash}</td>
                    <td style={tdStyle}>{row.hasPostedAd ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {/* Inside the table, not instead of it — filtering down to zero shouldn't take
                    the filter inputs away with it, leaving no way to widen whatever just emptied
                    the page. */}
                {result.items.length === 0 && (
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td colSpan={7} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}>
                      No users match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </form>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/logins", sp, p)}
          pageSize={limit}
          sp={sp}
        />
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

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

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

/** The filter row sits tight under the labels it belongs to — less vertical padding than the
 * label row above it, and a bottom border so the two read as one header block rather than the
 * filter inputs looking like a first data row. */
const filterThStyle: React.CSSProperties = {
  padding: "0 8px 8px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};

const headerInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "5px 7px",
  fontSize: 12,
  background: "var(--surface)",
  color: "var(--text)",
  width: 130,
  fontWeight: 400,
};

const headerSelectStyle: React.CSSProperties = { ...headerInputStyle, width: 110 };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
