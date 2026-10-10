import { requireAdmin } from "@/lib/requireAdmin";
import { fetchNotificationDailySummary } from "@/lib/bff";
import { str, type SearchParams } from "@/lib/searchParams";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { NotificationLogTable } from "@/components/NotificationLogTable";
import { FullPageLink } from "@/components/FullPageLink";

/** Per-day counts of every email/WhatsApp/push notification sent (both `ListingNotificationLog`
 * and `UserNotificationLog` rows), across every notification kind in the system — the existing
 * real-time ones (new message, favourite, interest) as well as the posted-ad reminder and daily
 * activity digest. 7-day default, same reasoning as post-funnel's: a single day's counts are too
 * small to be very informative on their own. Which users/listings were notified on a given day is
 * fetched only when that day's row is clicked — see NotificationLogTable. */
export default async function NotificationLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const from = str(sp.from) ?? daysAgoIST(7);
  const to = str(sp.to) ?? todayIST();

  const items = await fetchNotificationDailySummary(accessToken, {
    from: istDayStart(from),
    to: istDayEnd(to),
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Notification log</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          One row per IST calendar day. Click a day to load which users and listings were notified
          on each channel.
        </p>

        <form method="get">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
              marginBottom: 24,
              padding: 16,
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
            }}
          >
            <Field label="Date range (IST)">
              <DateRangeFilter basePath="/notification-log" sp={sp} currentFrom={from} currentTo={to}>
                <Field label="From (IST)">
                  <input type="date" name="from" defaultValue={from} style={dateInputStyle} />
                </Field>
                <Field label="To (IST)">
                  <input type="date" name="to" defaultValue={to} style={dateInputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>

            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
                  <th style={thStyle}>Date (IST)</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>WhatsApp</th>
                  <th style={thStyle}>Push</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>
              <NotificationLogTable items={items} />
            </table>
          </div>
        </form>
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
