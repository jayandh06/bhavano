import Link from "next/link";
import {
  POST_FEEDBACK_DIFFICULTIES,
  POST_FEEDBACK_DIFFICULTY_LABELS,
  POST_FEEDBACK_SOURCES,
  POST_FEEDBACK_SOURCE_LABELS,
  type AdminPostFeedbackRowDto,
} from "@bhavano/types/postFeedback";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAdminPostFeedback } from "@/lib/bff";
import { CLEAR_FILTERS_PARAM, SKIP_REMEMBER_PARAM } from "@/lib/rememberedFilters";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "@/lib/dateRangeDefaults";
import { formatDateTime } from "@/lib/formatDateTime";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FullPageLink } from "@/components/FullPageLink";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "low", label: "Low (1 to 2 stars)" },
  { value: "1", label: "1 star" },
  { value: "2", label: "2 stars" },
  { value: "3", label: "3 stars" },
  { value: "4", label: "4 stars" },
  { value: "5", label: "5 stars" },
];

/** The answers posters gave about filling in the post-ad form (docs/plans/post-ad-experience-feedback.md): average rating, how
 * many answered, what they found hard, and every written suggestion. Dates are when the answer was first saved, in IST; the default
 * window is the last 30 days. */
export default async function PostFeedbackPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;

  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));
  const from = str(sp.from) ?? daysAgoIST(30);
  const to = str(sp.to) ?? todayIST();
  const ratingRaw = str(sp.rating) ?? "";
  const rating = /^[1-5]$/.test(ratingRaw) ? Number(ratingRaw) : undefined;
  const band = ratingRaw === "low" ? "low" : undefined;
  const difficultyRaw = str(sp.difficulty);
  const difficulty = POST_FEEDBACK_DIFFICULTIES.find((d) => d === difficultyRaw);
  const sourceRaw = str(sp.source);
  const source = POST_FEEDBACK_SOURCES.find((s) => s === sourceRaw);
  const platform = str(sp.platform) === "web" ? "web" : str(sp.platform) === "app" ? "app" : undefined;
  const category = str(sp.category)?.trim() || undefined;
  const hasText = str(sp.hasText) === "yes" ? "yes" : undefined;
  const canContact = str(sp.canContact) === "yes" ? "yes" : undefined;
  const listingId = str(sp.listingId)?.trim() || undefined;

  const result = await fetchAdminPostFeedback(accessToken, {
    from: istDayStart(from),
    to: istDayEnd(to),
    rating,
    band,
    difficulty,
    source,
    platform,
    category,
    hasText,
    canContact,
    listingId,
    offset: (currentPage - 1) * limit,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  const { summary } = result;
  const maxStar = Math.max(1, ...summary.ratingCounts);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Post feedback</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          What posters said about filling in the post-ad form. {result.total.toLocaleString()} answer{result.total === 1 ? "" : "s"} match the
          current filters. An answer can be just a star rating; the chips and the note are optional.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <Card label="Answers" value={summary.answered.toLocaleString()} />
          <Card label="Average rating" value={summary.averageRating === null ? "—" : `${summary.averageRating} / 5`} />
          <Card label="With a written note" value={summary.withSuggestion.toLocaleString()} />
          <Card label="OK to contact" value={summary.canContact.toLocaleString()} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 20 }}>
          <div style={panel}>
            <div style={panelTitle}>Ratings</div>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.ratingCounts[stars - 1];
              return (
                <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ width: 44 }}>{stars} star{stars === 1 ? "" : "s"}</span>
                  <span style={{ flex: 1, background: "var(--border)", borderRadius: 4, height: 10, minWidth: 140 }}>
                    <span style={{ display: "block", height: 10, borderRadius: 4, background: stars <= 2 ? "#c0392b" : "var(--green)", width: `${(count / maxStar) * 100}%` }} />
                  </span>
                  <span style={{ width: 36, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
          <div style={{ ...panel, minWidth: 300 }}>
            <div style={panelTitle}>What was hard</div>
            {summary.difficultyCounts.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Nothing named yet.</div>
            ) : (
              summary.difficultyCounts.map((d) => (
                <div key={d.difficulty} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12.5, marginBottom: 4 }}>
                  <Link
                    href={`/feedback?difficulty=${d.difficulty}&from=${from}&to=${to}&${SKIP_REMEMBER_PARAM}=1`}
                    prefetch={false}
                    style={{ color: "var(--text)" }}
                  >
                    {POST_FEEDBACK_DIFFICULTY_LABELS[d.difficulty]}
                  </Link>
                  <strong>{d.count}</strong>
                </div>
              ))
            )}
          </div>
        </div>

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
            <Field label="Answered (IST)">
              <DateRangeFilter basePath="/feedback" sp={sp} currentFrom={from} currentTo={to}>
                <Field label="From (IST)">
                  <input type="date" name="from" defaultValue={from} style={inputStyle} />
                </Field>
                <Field label="To (IST)">
                  <input type="date" name="to" defaultValue={to} style={inputStyle} />
                </Field>
              </DateRangeFilter>
            </Field>
            <Field label="Rating">
              <SelectField name="rating" defaultValue={ratingRaw} style={inputStyle}>
                {RATING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="What was hard">
              <SelectField name="difficulty" defaultValue={difficulty ?? ""} style={inputStyle}>
                <option value="">Anything</option>
                {POST_FEEDBACK_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {POST_FEEDBACK_DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Reached via">
              <SelectField name="source" defaultValue={source ?? ""} style={inputStyle}>
                <option value="">Any</option>
                {POST_FEEDBACK_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {POST_FEEDBACK_SOURCE_LABELS[s]}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Platform">
              <SelectField name="platform" defaultValue={platform ?? ""} style={inputStyle}>
                <option value="">Any</option>
                <option value="web">Web</option>
                <option value="app">App</option>
              </SelectField>
            </Field>
            <Field label="Category">
              <input name="category" defaultValue={category ?? ""} placeholder="e.g. apartment" style={{ ...inputStyle, width: 140 }} />
            </Field>
            <Field label="Written note">
              <SelectField name="hasText" defaultValue={hasText ?? ""} style={inputStyle}>
                <option value="">Any</option>
                <option value="yes">Has a note</option>
              </SelectField>
            </Field>
            <Field label="Contact">
              <SelectField name="canContact" defaultValue={canContact ?? ""} style={inputStyle}>
                <option value="">Any</option>
                <option value="yes">OK to contact</option>
              </SelectField>
            </Field>
            <Field label="Listing ID">
              <input name="listingId" defaultValue={listingId ?? ""} placeholder="optional" style={{ ...inputStyle, width: 170 }} />
            </Field>
            <button type="submit" style={applyButtonStyle}>
              Apply filters
            </button>
            <Link href={`/feedback?${CLEAR_FILTERS_PARAM}=1`} prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
              Reset
            </Link>
          </div>
        </form>

        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11.5 }}>
                <th style={th}>Answered</th>
                <th style={th}>Rating</th>
                <th style={th}>Poster</th>
                <th style={th}>Ad</th>
                <th style={th}>What was hard</th>
                <th style={{ ...th, minWidth: 260 }}>Note</th>
                <th style={th}>Via</th>
              </tr>
            </thead>
            <tbody>
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                    No feedback matches these filters.
                  </td>
                </tr>
              ) : (
                result.items.map((row) => <FeedbackRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/feedback", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}

function FeedbackRow({ row }: { row: AdminPostFeedbackRowDto }) {
  const low = row.rating !== null && row.rating <= 2;
  const poster = row.userName ?? row.userPhone ?? row.userEmail ?? "Unknown";
  return (
    <tr style={{ borderTop: "1px solid var(--border)", verticalAlign: "top", ...(low ? { background: "rgba(192, 57, 43, 0.07)", boxShadow: "inset 4px 0 0 #c0392b" } : {}) }}>
      <td style={td}>{formatDateTime(row.createdAt)}</td>
      <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{row.rating === null ? <Dash /> : `${"★".repeat(row.rating)}${"☆".repeat(5 - row.rating)}`}</td>
      <td style={td}>
        <Link href={`/users/${row.userId}`} prefetch={false} style={{ color: "var(--text)", fontWeight: 600 }}>
          {poster}
        </Link>
        {row.canContact && <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>OK to contact</div>}
      </td>
      <td style={td}>
        <Link href={`/listings/${row.listingId}`} prefetch={false} style={{ color: "var(--text)" }}>
          {row.listingTitle}
        </Link>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {row.category} · {row.transactionType} · {row.platform ?? "unknown"}
          {row.appVersion ? ` ${row.appVersion}` : ""}
        </div>
      </td>
      <td style={td}>{row.difficulties.length === 0 ? <Dash /> : row.difficulties.map((d) => POST_FEEDBACK_DIFFICULTY_LABELS[d]).join(", ")}</td>
      <td style={{ ...td, whiteSpace: "pre-wrap" }}>{row.suggestion ?? <Dash />}</td>
      <td style={td}>{POST_FEEDBACK_SOURCE_LABELS[row.source] ?? row.source}</td>
    </tr>
  );
}

function Dash() {
  return <span style={{ color: "var(--muted)" }}>—</span>;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panel, minWidth: 150 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
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

const panel: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  padding: "12px 16px",
};

const panelTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 };

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "10px 12px" };

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
