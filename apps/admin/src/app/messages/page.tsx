import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAdminConversations } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FullPageLink } from "@/components/FullPageLink";
import { MessagesTable } from "@/components/MessagesTable";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";
import { UserPicker } from "@/components/UserPicker";

/** Who messaged whom, across the whole platform: every buyer enquiry by default, with the listing it was about,
 * and optionally the staff moderation and announcement threads. Read-only: opening a thread never marks anything
 * read. Linked from Users (the Enquiries count) and from a listing's own Messages box. Dates are the day the
 * conversation started, in IST; the default window is the last 7 days, and a link with empty `from`/`to` shows
 * all time. */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const from = str(sp.from) ?? daysAgoIST(7);
  const to = str(sp.to) ?? todayIST();
  const rawType = str(sp.type);
  const type = rawType === "any" || rawType === "moderation" || rawType === "announcement" ? rawType : "inquiry";
  const q = str(sp.q)?.trim() || undefined;
  const userId = str(sp.userId) || undefined;
  const userLabel = str(sp.userLabel);
  const listingId = str(sp.listingId)?.trim() || undefined;

  const result = await fetchAdminConversations(accessToken, {
    type,
    from: istDayStart(from),
    to: istDayEnd(to),
    q,
    userId,
    listingId,
    offset: (currentPage - 1) * limit,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  // Carried on the name links so "everything this person sent" keeps the same type and window.
  const linkParams = `&type=${type}&from=${from}&to=${to}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Messages</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          Who messaged whom. {result.total.toLocaleString()} conversation{result.total === 1 ? "" : "s"} match the
          current filters. Click a row to read it, a name to see everything that person sent or received, or the listing
          to open it. From and To follow who wrote first, which is not always the person who opened the chat. A green dot
          means the person it was sent to hasn&apos;t read the latest message. Reading here never marks anything read.
        </p>

        <form method="get">
          <div
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
            <Field label="Started (IST)">
              <DateRangeFilter basePath="/messages" sp={sp} currentFrom={from} currentTo={to}>
                <Field label="From (IST)">
                  <input type="date" name="from" defaultValue={from} style={inputStyle} />
                </Field>
                <Field label="To (IST)">
                  <input type="date" name="to" defaultValue={to} style={inputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>

            <Field label="Type">
              <SelectField name="type" defaultValue={type} style={{ ...inputStyle, minWidth: 190 }}>
                <option value="inquiry">Buyer enquiries</option>
                <option value="any">Everything, incl. staff threads</option>
                <option value="moderation">Staff moderation threads</option>
                <option value="announcement">Staff announcements</option>
              </SelectField>
            </Field>

            <Field label="Person (buyer or owner)">
              <UserPicker name="userId" labelName="userLabel" defaultUserId={userId} defaultLabel={userLabel} />
            </Field>

            <Field label="Search name, phone, email or listing">
              <input name="q" defaultValue={q ?? ""} placeholder="e.g. Asha or 2 BHK" style={{ ...inputStyle, minWidth: 220 }} />
            </Field>

            <Field label="Listing ID">
              <input name="listingId" defaultValue={listingId ?? ""} placeholder="optional" style={{ ...inputStyle, width: 190 }} />
            </Field>

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
          </div>
        </form>

        <MessagesTable items={result.items} linkParams={linkParams} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/messages", sp, p)}
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

const inputStyle: React.CSSProperties = {
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
