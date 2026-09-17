"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreateRequirementInput } from "@bhavano/types";
import { createRequirementAction } from "@/app/actions/requirements";
import { useAuthGate } from "./AuthGateProvider";

/**
 * Turns a dead-end search into a captured requirement — Phase 0 of
 * docs/plans/property-requirements-demand-side.md.
 *
 * The whole design rests on one observation from production data: this app's seekers act on
 * immediate, concrete things (116 conversations, 10 contact reveals) and ignore anything abstract
 * or deferred (3 favourites, 0 saved searches — the last of which was also both undiscoverable
 * and paywalled). So this is not a form to go and find; it is one button, at the moment the
 * search failed, already carrying what they just typed. `criteria` comes from the page's own
 * resolved filters, so there is nothing to re-enter.
 *
 * The ask is framed as a **confirmation**, not a form: it states the criteria back, asks whether
 * we may go find it and whether owners and agents with a match may contact them, and only then
 * writes the row. That is the honest shape of the exchange — the one thing about a requirement
 * that cannot be inferred from the search they just ran is permission to act on it.
 *
 * A client leaf by necessity (a click, a server action, and the login gate) — kept deliberately
 * small so `ListingGrid` and every page rendering it stay server components and nothing moves out
 * of the RSC output.
 */
export function RequirementPrompt({
  criteria,
  label,
  variant = "empty",
}: {
  criteria: Omit<CreateRequirementInput, "searchLabel">;
  /** How the search reads to a human — the page heading. Becomes both the copy here and the
   * stored `searchLabel`, so an admin reading the row later sees what the seeker was shown. */
  label: string;
  /** `empty` = the zero-results card. `inline` = a quiet link alongside real results, for
   * someone who looked and did not like what they found. */
  variant?: "empty" | "inline";
}) {
  const { requireLogin } = useAuthGate();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [hasAlert, setHasAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Pre-ticked: someone asking us to go and find a house generally does want the person who has
   * one to ring them, and the box is right there to untick. Unticking is a real choice, not a
   * cosmetic one — it keeps their number with Bhavano. */
  const [allowContact, setAllowContact] = useState(true);
  /** The inline variant asks the same question, but only once they have shown interest —
   * otherwise it would be a consent form sitting under every page of results. */
  const [inlineOpen, setInlineOpen] = useState(false);

  async function submit() {
    setState("saving");
    setError(null);

    const result = await createRequirementAction({ ...criteria, searchLabel: label, contactConsent: allowContact });

    if (result.success) {
      setHasAlert(result.requirement.hasAlert);
      setState("done");
      return;
    }
    if (result.needsLogin) {
      // Resume straight into the save once they are in, rather than making them press the same
      // button again — which reads as the first press having failed. Same pattern as the posting
      // wizard's publish-after-login.
      setState("idle");
      requireLogin({ onSuccess: () => void submit() });
      return;
    }
    setError(result.error);
    setState("idle");
  }

  if (state === "done") {
    return (
      <div className={variant === "empty" ? doneCardClass : "text-[13px] text-green font-bold"}>
        {/* Says which of two things will actually happen. With an alert we can promise to tell
            them; without one, only that a person will look. Implying an alert that will never
            arrive would be worse than the dead end this replaces. */}
        {hasAlert
          ? "Confirmed — we'll message you as soon as something matching is posted."
          : "Confirmed — our team will look into what's available and get back to you."}
        <div className="mt-1.5 text-[12.5px] font-normal">
          {allowContact
            ? "Owners and agents with a matching property can get in touch with you directly."
            : "Only Bhavano will contact you — your number stays with us."}
        </div>
        {/* Offered *after* the save, never before it. The one-tap capture works precisely because
            it is not a form, so the extra detail is a follow-on for whoever wants to give it —
            not a step in front of the thing that already succeeded. */}
        <div className="mt-2 font-normal">
          <Link href="/my-requirements" className="text-[12.5px] underline text-inherit">
            Add a budget or timeline →
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "inline" && !inlineOpen) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setInlineOpen(true)} className={inlineButtonClass}>
          Not finding it? Get a call when a match is posted
        </button>
      </div>
    );
  }

  const confirmation = (
    <>
      {/* The criteria, stated back. This is the thing being confirmed, so it has to be visible and
        * verbatim — it is also exactly what gets stored as `searchLabel`. */}
      <div className="rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 text-[13px] font-semibold text-text">
        {label}
      </div>
      <label className="mt-3.5 flex items-start gap-2.5 text-left text-[13px] text-text cursor-pointer">
        <input
          type="checkbox"
          checked={allowContact}
          onChange={(e) => setAllowContact(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Owners and agents with a matching property may call or message me.
          <span className="block text-[12px] text-muted">
            Leave this unticked and only Bhavano will contact you.
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={state === "saving"}
        className={`${primaryButtonClass} mt-4 w-full`}
      >
        {state === "saving" ? "Confirming…" : "Yes, find this for me"}
      </button>
      {error && <p className="text-[12px] text-danger mt-3 mb-0">{error}</p>}
    </>
  );

  if (variant === "inline") {
    return <div className="max-w-[420px] rounded-xl border border-border bg-surface p-4">{confirmation}</div>;
  }

  return (
    <div className="my-10 mx-auto max-w-[520px] border border-border rounded-xl bg-surface p-7">
      {/* A question, not an announcement. The old copy told them their search had failed and then
        * asked them to "tell us what you need" — which they just had, by searching. */}
      <div className="font-lora text-lg font-bold mb-1.5 text-center">Shall we find this for you?</div>
      <p className="text-muted text-[13px] m-0 mb-4 text-center">
        There&apos;s nothing matching right now. Confirm below and we&apos;ll go looking — you don&apos;t have to
        keep checking back.
      </p>
      {confirmation}
      <p className="text-muted text-[11.5px] mt-4 mb-0 text-center">Or adjust the filters above to widen the search.</p>
    </div>
  );
}

const doneCardClass = "my-10 mx-auto max-w-[520px] text-center border border-green rounded-xl bg-surface p-7 text-[13.5px] font-bold text-green";

const primaryButtonClass =
  "bg-green text-on-green border-none rounded-lg px-5 py-2.5 text-[13.5px] font-bold cursor-pointer disabled:opacity-60";

const inlineButtonClass =
  "bg-transparent border-none p-0 text-[13px] font-bold text-green cursor-pointer underline disabled:opacity-60";
