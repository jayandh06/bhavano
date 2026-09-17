"use client";

import { useState } from "react";
import type { RequirementDto } from "@bhavano/types";
import {
  closeRequirementAction,
  renewRequirementAction,
  updateRequirementDetailsAction,
} from "@/app/actions/requirements";

/** How far ahead of expiry the Renew affordance appears — same 7-day window as a listing's, so
 * the two pages behave alike. */
const RENEW_WINDOW_DAYS = 7;

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * One captured requirement, with the controls its owner should have over it — Phase 1 of
 * docs/plans/property-requirements-demand-side.md.
 *
 * Deliberately not the centrepiece of the feature: the engagement data says this app's seekers
 * act on immediate things and rarely come back to a page, so the product is the notification and
 * this exists so nobody feels their post vanished, and so the minority who do return can renew,
 * close it, or add the detail the one-tap capture never asked for.
 */
export function MyRequirementCard({ requirement }: { requirement: RequirementDto }) {
  const [current, setCurrent] = useState(requirement);
  const [note, setNote] = useState(requirement.note ?? "");
  const [moveInBy, setMoveInBy] = useState(requirement.moveInBy?.slice(0, 10) ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDetails, setSavedDetails] = useState(false);

  const closed = current.status === "closed";
  const expiringSoon = !closed && !current.isExpired && daysUntil(current.expiresAt) <= RENEW_WINDOW_DAYS;

  async function run(key: string, action: () => Promise<{ success: boolean; requirement?: RequirementDto; error?: string }>) {
    setPending(key);
    setError(null);
    setSavedDetails(false);
    const result = await action();
    setPending(null);
    if (result.success && result.requirement) {
      setCurrent(result.requirement);
      if (key === "details") setSavedDetails(true);
      return;
    }
    setError(result.error ?? "That didn't work — try again");
  }

  const statusLine = closed
    ? current.closedReason === "fulfilled"
      ? "Closed — you found something"
      : current.closedReason === "withdrawn"
        ? "Withdrawn"
        : current.closedReason === "expired"
          ? "Expired — renew to start it again"
          : "Closed"
    : current.isExpired
      ? "Expired — renew to start it again"
      : `Active until ${dateFormatter.format(new Date(current.expiresAt))}`;

  return (
    <div className="border border-border rounded-xl bg-surface p-5">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="font-lora text-lg font-bold">{current.searchLabel}</div>
          <div className="text-[13px] text-muted mt-1">
            {[
              current.areaName ?? current.cityName,
              current.bedrooms ? `${current.bedrooms} BHK` : null,
              current.maxPrice ? `up to ₹${current.maxPrice.toLocaleString("en-IN")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="text-[12.5px] text-right">
          <div className={closed || current.isExpired ? "text-muted font-bold" : "text-green font-bold"}>{statusLine}</div>
          <div className="text-muted mt-1">
            {current.hasAlert ? "We'll alert you on new matches" : "No alert — our team follows up"}
          </div>
        </div>
      </div>

      {!closed && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
          {/* The detail the one-tap capture never asked for. Optional on purpose: the capture
              worked precisely because it wasn't a form, so this is here for whoever wants to add
              to it, not a gate in front of anything. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted font-bold">Anything else we should know?</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ground floor, close to a metro station, pet friendly…"
              className="border border-border rounded-lg px-3 py-2 text-[13.5px] bg-surface text-text"
            />
          </label>
          <label className="flex flex-col gap-1.5 max-w-[220px]">
            <span className="text-[12px] text-muted font-bold">Needed by</span>
            <input
              type="date"
              value={moveInBy}
              onChange={(e) => setMoveInBy(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-[13.5px] bg-surface text-text"
            />
          </label>
          <div className="flex gap-2 items-center flex-wrap">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() =>
                void run("details", () =>
                  updateRequirementDetailsAction(current.id, {
                    note: note.trim() || undefined,
                    moveInBy: moveInBy ? new Date(moveInBy).toISOString() : undefined,
                  }),
                )
              }
              className="bg-green text-on-green border-none rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60"
            >
              {pending === "details" ? "Saving…" : "Save details"}
            </button>
            {savedDetails && <span className="text-[12.5px] text-green font-bold">Saved</span>}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border flex gap-3 items-center flex-wrap">
        {(expiringSoon || current.isExpired || current.closedReason === "expired") && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void run("renew", () => renewRequirementAction(current.id))}
            className="bg-green text-on-green border-none rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60"
          >
            {pending === "renew" ? "Renewing…" : "Renew for 30 days"}
          </button>
        )}
        {!closed && (
          <>
            {/* Two buttons, not one "close": which of the two happened is the only measure of
                whether this feature actually helped anyone. */}
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void run("fulfilled", () => closeRequirementAction(current.id, "fulfilled"))}
              className="bg-transparent border border-border rounded-lg px-4 py-2 text-[13px] font-bold text-text cursor-pointer disabled:opacity-60"
            >
              {pending === "fulfilled" ? "Saving…" : "I found something"}
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void run("withdrawn", () => closeRequirementAction(current.id, "withdrawn"))}
              className="bg-transparent border-none p-0 text-[13px] text-muted underline cursor-pointer disabled:opacity-60"
            >
              {pending === "withdrawn" ? "Withdrawing…" : "No longer looking"}
            </button>
          </>
        )}
        {error && <span className="text-[12.5px] text-danger">{error}</span>}
      </div>
    </div>
  );
}
