"use client";

import { useState } from "react";
import { postAdScenarios } from "@/lib/postAdScenarios";

const SCENARIOS = postAdScenarios();

/** Admin-only shortcut on /post: choose a ready-made ad and it fills the whole form (fields, three drawn photos, the pin at the chosen
 * city's centre) and opens the Preview step, so each category and edge case can be tried without typing. Posting from there creates a
 * real listing titled "[TEST] ...", which stays live until it is removed in admin. See docs/plans/post-ad-test-scenarios.md. */
export function AdminTestScenarios({
  onApply,
  busy,
  error,
}: {
  onApply: (scenarioId: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]?.id ?? "");

  return (
    <div
      role="region"
      aria-label="Admin test scenarios"
      className="mb-4 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-text"
    >
      <div className="text-[13px] font-bold">Admin: test scenarios</div>
      <p className="m-0 mt-1 text-[12px] text-muted">
        Fills the form and opens the preview. Posting creates a real ad titled &ldquo;[TEST] &hellip;&rdquo; that stays live until you remove it
        in admin.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          aria-label="Scenario"
          className="min-w-[260px] rounded-lg border border-border bg-bg px-2.5 py-2 text-[13px] text-text"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !scenarioId}
          onClick={() => onApply(scenarioId)}
          className="cursor-pointer rounded-lg border-0 bg-green px-4 py-2 text-[13px] font-bold text-on-green disabled:opacity-60"
        >
          {busy ? "Filling…" : "Fill and open preview"}
        </button>
      </div>
      {error && (
        <p className="m-0 mt-2 text-[12px] font-bold text-[#b3413a]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
