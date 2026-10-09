import type { PostEntrySource } from "@bhavano/types/postEntry";
import { POST_ENTRY_SOURCES } from "@bhavano/types/postEntry";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchPostFunnel, type PostFunnelQuery } from "@/lib/bff";
import { str, type SearchParams } from "@/lib/searchParams";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { POST_ENTRY_LABELS } from "@/lib/pageTrail";
import { SelectField } from "@/components/SelectField";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FullPageLink } from "@/components/FullPageLink";

const PLATFORM_OPTIONS: { value: PostFunnelQuery["platform"] | "any"; label: string }[] = [
  { value: "any", label: "All platforms" },
  { value: "web", label: "Web" },
  { value: "app", label: "Mobile app" },
];

const LOGGED_IN_OPTIONS: { value: PostFunnelQuery["loggedIn"] | "any"; label: string }[] = [
  { value: "any", label: "Logged in or not" },
  { value: "yes", label: "Logged in at that step" },
  { value: "no", label: "Not logged in at that step" },
];

/** How far many visitors who open `/post` actually get, and which on-site link sent them there —
 * see docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Deliberately a 7-day
 * default (not Page Visits' own 1-day one): `/post` traffic is a small slice of the whole site,
 * and a single day's step counts are too small for the %-of-previous figures to mean much. */
export default async function PostFunnelPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const from = str(sp.from) ?? daysAgoIST(7);
  const to = str(sp.to) ?? todayIST();
  // "any" is this page's own sentinel for "no filter" (the <select>'s own default option) — the
  // BFF's PostFunnelQueryDto only accepts a real entry/platform/loggedIn value or nothing at all.
  const rawEntry = str(sp.entry);
  const entry = rawEntry && rawEntry !== "any" ? (rawEntry as PostEntrySource) : undefined;
  const rawPlatform = str(sp.platform);
  const platform = rawPlatform && rawPlatform !== "any" ? (rawPlatform as PostFunnelQuery["platform"]) : undefined;
  const rawLoggedIn = str(sp.loggedIn);
  const loggedIn = rawLoggedIn && rawLoggedIn !== "any" ? (rawLoggedIn as PostFunnelQuery["loggedIn"]) : undefined;

  const result = await fetchPostFunnel(accessToken, {
    from: istDayStart(from),
    to: istDayEnd(to),
    entry,
    platform,
    loggedIn,
  });

  const topOfFunnel = result.steps[0]?.sessions ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Post-ad funnel</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          Each step counts distinct sessions that reached it. The date range is IST. Filtering by
          entry point or logged-in state can undercount the &ldquo;Arrived at /post&rdquo; row
          slightly &mdash; see docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md
          for why.
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
            <Field label="Entry point">
              <SelectField name="entry" defaultValue={entry ?? "any"} style={selectStyle}>
                <option value="any">Every entry point</option>
                {POST_ENTRY_SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {POST_ENTRY_LABELS[value] ?? value}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Platform">
              <SelectField name="platform" defaultValue={platform ?? "any"} style={selectStyle}>
                {PLATFORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Logged in">
              <SelectField name="loggedIn" defaultValue={loggedIn ?? "any"} style={selectStyle}>
                {LOGGED_IN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Date range (IST)">
              <DateRangeFilter basePath="/post-funnel" sp={sp} currentFrom={from} currentTo={to}>
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
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {result.steps.map((step) => (
            <div
              key={step.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--surface)",
              }}
            >
              <div style={{ width: 160, fontSize: 13.5, fontWeight: 700 }}>{step.label}</div>
              <div style={{ flex: 1, height: 10, background: "var(--surface-alt)", borderRadius: 6, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${topOfFunnel > 0 ? Math.max(2, (step.sessions / topOfFunnel) * 100) : 0}%`,
                    background: "var(--green)",
                  }}
                />
              </div>
              <div style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: 700 }}>
                {step.sessions.toLocaleString()}
              </div>
              <div style={{ width: 90, textAlign: "right", fontSize: 12.5, color: "var(--muted)" }}>
                {step.pctOfPrevious === null ? "—" : `${step.pctOfPrevious}% of prev.`}
              </div>
            </div>
          ))}
        </div>
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
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

const dateInputStyle: React.CSSProperties = { ...selectStyle, minWidth: "auto" };

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
