"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AREA_OVERVIEW_REVIEW_CHECKLIST,
  validateAreaOverviewContent,
  type AdminAreaOverviewDetail,
  type AreaFaq,
  type AreaOverviewContent,
  type AreaOverviewDto,
  type AreaOverviewStatus,
} from "@bhavano/types/areaOverview";
import { saveAreaOverviewAction, setAreaOverviewStatusAction } from "@/app/actions/area-overviews";
import { formatDateTime } from "@/lib/formatDateTime";

const STATUS_LABEL: Record<AreaOverviewStatus, string> = { draft: "Draft", in_review: "In review", published: "Published" };
const STATUS_COLOR: Record<AreaOverviewStatus, string> = { draft: "var(--muted)", in_review: "var(--gold)", published: "var(--green)" };

/** Paragraphs are typed as plain text, one blank line between them. */
const toText = (items: string[]) => items.join("\n\n");
const fromText = (text: string) => text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);

export function AreaOverviewEditor({ detail }: { detail: AdminAreaOverviewDetail }) {
  const router = useRouter();
  const [saved, setSaved] = useState<AreaOverviewDto | null>(detail.overview);
  const [about, setAbout] = useState(toText(detail.overview?.about ?? []));
  const [gettingAround, setGettingAround] = useState(toText(detail.overview?.gettingAround ?? []));
  const [faqs, setFaqs] = useState<AreaFaq[]>(detail.overview?.faqs ?? [{ question: "", answer: "" }]);
  const [ticked, setTicked] = useState<boolean[]>(AREA_OVERVIEW_REVIEW_CHECKLIST.map(() => false));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const content: AreaOverviewContent = useMemo(
    () => ({
      about: fromText(about),
      gettingAround: fromText(gettingAround),
      faqs: faqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question || f.answer),
    }),
    [about, gettingAround, faqs],
  );
  const problems = useMemo(() => validateAreaOverviewContent(content), [content]);
  const savedContent = saved ? JSON.stringify({ about: saved.about, gettingAround: saved.gettingAround, faqs: saved.faqs }) : null;
  const dirty = savedContent !== JSON.stringify(content);
  const status = saved?.status ?? null;
  const allTicked = ticked.every(Boolean);

  async function run(task: () => Promise<{ success: true; overview: AreaOverviewDto } | { success: false; error: string }>, done: string) {
    setBusy(true);
    setMessage(null);
    const result = await task();
    setBusy(false);
    if (!result.success) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setSaved(result.overview);
    setTicked(AREA_OVERVIEW_REVIEW_CHECKLIST.map(() => false));
    setMessage({ kind: "ok", text: done });
    router.refresh();
  }

  const save = () => run(() => saveAreaOverviewAction(detail.areaId, content), "Saved as a draft.");
  const changeStatus = (next: AreaOverviewStatus, done: string) =>
    run(() => setAreaOverviewStatusAction(detail.areaId, next, allTicked), done);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: status ? STATUS_COLOR[status] : "var(--muted)" }}>
          {status ? STATUS_LABEL[status] : "No text yet"}
        </span>
        {saved?.reviewedByName && saved.reviewedAt && (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Approved by {saved.reviewedByName} on {formatDateTime(saved.reviewedAt)}
          </span>
        )}
        {dirty && <span style={{ fontSize: 12.5, color: "var(--gold)" }}>Unsaved changes</span>}
      </div>

      <Section title="About">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={8}
          placeholder="One to four paragraphs. Leave a blank line between paragraphs."
          style={areaStyle}
        />
      </Section>

      <Section title="Getting around (optional)">
        <textarea value={gettingAround} onChange={(e) => setGettingAround(e.target.value)} rows={4} style={areaStyle} />
      </Section>

      <Section title="Frequently asked questions">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface)" }}>
              <input
                value={faq.question}
                onChange={(e) => setFaqs(faqs.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))}
                placeholder="Question"
                style={{ ...areaStyle, marginBottom: 8 }}
              />
              <textarea
                value={faq.answer}
                onChange={(e) => setFaqs(faqs.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))}
                rows={3}
                placeholder="Answer"
                style={areaStyle}
              />
              <button type="button" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} style={linkButtonStyle}>
                Remove question
              </button>
            </div>
          ))}
          {faqs.length < 6 && (
            <button type="button" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])} style={{ ...buttonStyle, alignSelf: "flex-start" }}>
              Add a question
            </button>
          )}
        </div>
      </Section>

      <Section title="Checks">
        {problems.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--green)" }}>All automatic checks pass.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--danger)" }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Review checklist">
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--muted)" }}>
          Tick every item to publish. Someone who knows the area should do this, not only the person who wrote the text.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {AREA_OVERVIEW_REVIEW_CHECKLIST.map((item, i) => (
            <label key={item} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={ticked[i]}
                onChange={(e) => setTicked(ticked.map((t, j) => (j === i ? e.target.checked : t)))}
                style={{ marginTop: 3 }}
              />
              {item}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Preview">
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--surface)", maxWidth: 720 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>
            About {detail.areaName}, {detail.cityName}
          </h2>
          {content.about.map((t, i) => (
            <p key={i} style={previewP}>{t}</p>
          ))}
          {content.gettingAround.length > 0 && <h3 style={previewH3}>Getting around</h3>}
          {content.gettingAround.map((t, i) => (
            <p key={i} style={previewP}>{t}</p>
          ))}
          {content.faqs.length > 0 && <h3 style={previewH3}>Frequently asked questions</h3>}
          {content.faqs.map((f, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{f.question}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>{f.answer}</div>
            </div>
          ))}
        </div>
      </Section>

      {message && (
        <p style={{ margin: 0, fontSize: 13, color: message.kind === "ok" ? "var(--green)" : "var(--danger)" }}>{message.text}</p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "sticky", bottom: 0, padding: "12px 0", background: "var(--bg)" }}>
        <button type="button" onClick={save} disabled={busy || problems.length > 0 || !dirty} style={buttonStyle}>
          Save draft
        </button>
        {saved && status === "draft" && !dirty && (
          <button type="button" onClick={() => changeStatus("in_review", "Sent for review.")} disabled={busy || problems.length > 0} style={buttonStyle}>
            Send for review
          </button>
        )}
        {saved && status !== "published" && !dirty && (
          <button
            type="button"
            onClick={() => changeStatus("published", "Published. It appears on the site within about an hour.")}
            disabled={busy || problems.length > 0 || !allTicked}
            style={{ ...buttonStyle, background: "var(--green)", color: "var(--on-green, #fff)", borderColor: "var(--green)" }}
          >
            Approve and publish
          </button>
        )}
        {saved && status !== "draft" && !dirty && (
          <button type="button" onClick={() => changeStatus("draft", "Moved back to draft and removed from the site.")} disabled={busy} style={buttonStyle}>
            {status === "published" ? "Unpublish" : "Back to draft"}
          </button>
        )}
      </div>
      {dirty && saved && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Save the draft before sending it for review or publishing.</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}

const areaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 13.5,
  lineHeight: 1.5,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
};
const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
};
const linkButtonStyle: React.CSSProperties = { marginTop: 8, padding: 0, border: 0, background: "none", color: "var(--danger)", fontSize: 12.5, cursor: "pointer" };
const previewP: React.CSSProperties = { fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 8px" };
const previewH3: React.CSSProperties = { fontSize: 14, margin: "14px 0 6px" };
