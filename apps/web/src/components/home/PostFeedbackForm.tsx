"use client";

import { useState } from "react";
import {
  POST_FEEDBACK_DIFFICULTIES,
  POST_FEEDBACK_DIFFICULTY_LABELS,
  POST_FEEDBACK_MAX_SUGGESTION,
  type PostFeedbackDifficulty,
  type PostFeedbackDto,
  type PostFeedbackSource,
} from "@bhavano/types/postFeedback";
import { savePostFeedbackAction } from "@/app/actions/feedback";

const STAR_WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/** "How was posting your ad?" — one tap for a rating (saved at once), then optional chips for what was hard, a suggestion and a
 * permission to contact. Used on the post-ad success screen (`variant="card"`) and on the `/feedback/post/[listingId]` page that the
 * push and in-app requests open (`variant="page"`). See docs/plans/post-ad-experience-feedback.md.
 *
 * Every step saves to the same row, so a poster who only taps a star has still answered. A leaf client component: nothing that
 * crawlers read lives in it. */
export function PostFeedbackForm({
  listingId,
  source,
  initial,
  variant = "card",
}: {
  listingId: string;
  source: PostFeedbackSource;
  initial?: PostFeedbackDto | null;
  variant?: "card" | "page";
}) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [difficulties, setDifficulties] = useState<PostFeedbackDifficulty[]>(initial?.difficulties ?? []);
  const [suggestion, setSuggestion] = useState(initial?.suggestion ?? "");
  const [canContact, setCanContact] = useState(initial?.canContact ?? false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tapStar(value: number) {
    setRating(value);
    setError(null);
    const result = await savePostFeedbackAction({ listingId, rating: value, source });
    if (!result.success) setError(result.error);
  }

  function toggleDifficulty(d: PostFeedbackDifficulty) {
    setDifficulties((current) => (current.includes(d) ? current.filter((x) => x !== d) : [...current, d]));
  }

  async function send() {
    setSaving(true);
    setError(null);
    const result = await savePostFeedbackAction({
      listingId,
      ...(rating ? { rating } : {}),
      difficulties,
      suggestion,
      canContact,
      source,
    });
    setSaving(false);
    if (result.success) setDone(true);
    else setError(result.error);
  }

  const wrapper =
    variant === "card"
      ? "w-full max-w-[440px] rounded-xl border border-border bg-surface p-4 text-left"
      : "w-full max-w-[560px] rounded-xl border border-border bg-surface p-5 text-left";

  if (done) {
    return (
      <div className={wrapper} role="status">
        <p className="m-0 text-sm font-bold text-text">Thank you, this helps us make posting easier.</p>
      </div>
    );
  }

  return (
    <section className={wrapper} aria-label="Feedback on posting your ad">
      <h3 className="m-0 mb-1 text-[15px] font-bold text-text">How was posting your ad?</h3>
      <p className="m-0 mb-3 text-xs text-muted">Tap a star. It takes less than half a minute.</p>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? "" : "s"}, ${STAR_WORDS[value - 1]}`}
            onClick={() => void tapStar(value)}
            className={`h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent text-[28px] leading-none ${
              rating !== null && value <= rating ? "text-gold" : "text-border"
            }`}
          >
            ★
          </button>
        ))}
        {rating !== null && <span className="ml-2 text-xs font-bold text-text-soft">{STAR_WORDS[rating - 1]}</span>}
      </div>

      {rating !== null && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="m-0 mb-2 text-[13px] font-bold text-text">Was anything hard? (optional)</p>
            <div className="flex flex-wrap gap-2">
              {POST_FEEDBACK_DIFFICULTIES.map((d) => {
                const on = difficulties.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDifficulty(d)}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold ${
                      on ? "border-green bg-green text-on-green" : "border-border bg-bg text-text"
                    }`}
                  >
                    {POST_FEEDBACK_DIFFICULTY_LABELS[d]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-text">What should we improve? (optional)</span>
            <textarea
              value={suggestion}
              maxLength={POST_FEEDBACK_MAX_SUGGESTION}
              rows={3}
              onChange={(e) => setSuggestion(e.target.value)}
              className="w-full resize-y rounded-lg border border-border bg-bg p-2.5 text-sm text-text"
              placeholder="Anything that confused you, slowed you down or was missing"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs text-text-soft">
            <input type="checkbox" checked={canContact} onChange={(e) => setCanContact(e.target.checked)} className="mt-0.5" />
            <span>You may contact me about this feedback.</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void send()}
              disabled={saving}
              className="cursor-pointer rounded-lg border-0 bg-green px-5 py-2.5 text-sm font-bold text-on-green disabled:opacity-60"
            >
              {saving ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="m-0 mt-3 text-xs font-bold text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
