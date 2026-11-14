"use client";

import type { PostFormVariant } from "@/lib/postFormVariant";

const VERSIONS: { value: PostFormVariant; label: string; hint: string }[] = [
  { value: "v1", label: "Original", hint: "v1: every field on one page" },
  { value: "v2", label: "Redesigned", hint: "v2: search and photos and video together" },
  { value: "v3", label: "Step by step", hint: "v3: each section appears once the one above is done" },
];

/** Admin-only switch on /post: look at the post-ad form as any of its versions. Admins get the newest (v3) by default; this adds `?form=` to the
 * address and reloads, and the draft being written is kept (it is saved in the browser). Funnel events from admin sessions are recorded as
 * `admin` whichever version is shown, so looking around never counts towards the comparison. See docs/plans/post-ad-simpler-form.md. */
export function AdminFormVersionSwitch({ current }: { current: PostFormVariant }) {
  function choose(version: PostFormVariant) {
    if (version === current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("form", version);
    window.location.assign(url.toString());
  }

  return (
    <div role="group" aria-label="Admin form version" className="mb-4 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-text">
      <div className="text-[13px] font-bold">Admin: form version</div>
      <p className="m-0 mt-1 text-[12px] text-muted">
        You see the newest version by default. Pick another to look at it; the page reloads and your draft is kept. Your sessions never count
        towards the version comparison.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {VERSIONS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => choose(v.value)}
            aria-pressed={current === v.value}
            title={v.hint}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-bold cursor-pointer ${
              current === v.value ? "border-green bg-green text-on-green" : "border-border bg-bg text-text"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
