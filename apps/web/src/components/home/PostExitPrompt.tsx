"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POST_FOR_ME_PATH } from "@bhavano/types/support";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";
import { withBasePath } from "@/lib/basePath";

export type ExitReason = "location" | "photos" | "fields" | "browsing" | "other";
type Trigger = "leave" | "idle";

const REASONS: { value: ExitReason; label: string }[] = [
  { value: "location", label: "The location / map" },
  { value: "photos", label: "Photos" },
  { value: "fields", label: "Too many questions" },
  { value: "browsing", label: "Just looking" },
  { value: "other", label: "Something else" },
];

const ASKED_KEY = "bhavano:post-exit-asked";
/** Asked at most once a week per browser: it is a question, not a wall. */
const ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;
/** Desktop: someone who moves to the tab bar within seconds of opening Details hasn't really tried the form yet. */
const DWELL_MS = 15_000;
/** Phones can't signal "about to leave", so long quiet on Details stands in for it. */
const IDLE_MS = 60_000;

function askedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(ASKED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < ASK_AGAIN_MS;
  } catch {
    return true; // No storage: we couldn't stop it repeating, so don't ask at all.
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    // See askedRecently.
  }
}

/** Same synthetic-pageview trick as the wizard's other events (reportBoostRecoveryEvent), read back by admin's Page visits. */
function record(query: string) {
  void fetch(withBasePath("/api/analytics/pageview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/post/exit-reason?${query}` }),
    keepalive: true,
  }).catch(() => {
    // Best-effort.
  });
}

function helpFor(reason: ExitReason, minPhotos: number): string {
  switch (reason) {
    case "location":
      return "Type the street, building or area name in the search box, or tap Use my current location if you are at the property.";
    case "photos":
      return `You need at least ${minPhotos} photos. Phone photos are fine, from the camera or your gallery.`;
    case "fields":
      return "Only the fields marked * are needed to post. You can leave the rest blank and add them later.";
    case "browsing":
      return "No problem. Your ad is saved on this device, so you can come back and finish it any time.";
    case "other":
      return "Tell us what went wrong and we will help, or post it for you.";
  }
}

/**
 * "What's stopping you?" on the Details step, at the moment a seller looks like leaving: on desktop when the mouse heads for the tab bar
 * (after 15 seconds on the step), on phones after a minute with no tap, typing or scrolling. One tap answers; the answer shows a tip for
 * that problem and the "Let us post it for you" hand-off. Non-blocking (a card, not a modal), shown at most once a week. The answer is
 * recorded as `/post/exit-reason?...`, so admin sees why people leave instead of guessing from the last field touched. See
 * docs/plans/recover-sellers-who-leave-without-posting.md, item 2c.
 */
export function PostExitPrompt({ enabled, minPhotos }: { enabled: boolean; minPhotos: number }) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [reason, setReason] = useState<ExitReason | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!enabled || trigger || closed || askedRecently()) return;
    const startedAt = Date.now();
    function show(t: Trigger) {
      markAsked();
      setTrigger(t);
      record(`event=shown&trigger=${t}`);
      pushDataLayerEvent("post_exit_question", { event: "shown", trigger: t });
    }
    if (!window.matchMedia("(hover: none)").matches) {
      const onOut = (e: MouseEvent) => {
        if (!e.relatedTarget && e.clientY <= 0 && Date.now() - startedAt >= DWELL_MS) show("leave");
      };
      document.addEventListener("mouseout", onOut);
      return () => document.removeEventListener("mouseout", onOut);
    }
    let timer = window.setTimeout(() => show("idle"), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => show("idle"), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "input", "scroll"] as const;
    for (const ev of events) window.addEventListener(ev, reset, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer);
      for (const ev of events) window.removeEventListener(ev, reset, { capture: true });
    };
  }, [enabled, trigger, closed]);

  if (!enabled || !trigger || closed) return null;

  function answer(value: ExitReason) {
    setReason(value);
    record(`event=answered&reason=${value}`);
    pushDataLayerEvent("post_exit_question", { event: "answered", reason: value });
  }

  function close() {
    if (!reason) {
      record("event=dismissed");
      pushDataLayerEvent("post_exit_question", { event: "dismissed" });
    }
    setClosed(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Before you go"
      className="fixed z-40 bottom-[calc(0.75rem+var(--app-strip-h,0px))] inset-x-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px] rounded-xl border border-border bg-surface text-text shadow-lg p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-bold text-[14px]">{reason ? "Here's what helps" : "Before you go: what's stopping you?"}</div>
        <button type="button" onClick={close} aria-label="Close" className="bg-transparent border-0 text-muted cursor-pointer p-0.5 leading-none">
          <Icon name="close" />
        </button>
      </div>
      {reason ? (
        <p className="m-0 mt-2 text-[13px] text-text-soft">{helpFor(reason, minPhotos)}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => answer(r.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-bold text-text-soft cursor-pointer hover:border-green"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      <p className="m-0 mt-3 text-[12.5px] text-muted">
        Stuck?{" "}
        <Link
          href={POST_FOR_ME_PATH}
          target="_blank"
          onClick={() => record("event=post_for_me")}
          className="text-green font-bold"
        >
          Let us post it for you
        </Link>{" "}
        &middot; your ad is saved on this device.
      </p>
    </div>
  );
}
