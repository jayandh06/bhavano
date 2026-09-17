"use client";

import { useState } from "react";
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

  async function submit() {
    setState("saving");
    setError(null);

    const result = await createRequirementAction({ ...criteria, searchLabel: label });

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
          ? "Noted — we'll message you as soon as something matching is posted."
          : "Noted — our team will look into what's available and get back to you."}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void submit()} disabled={state === "saving"} className={inlineButtonClass}>
          {state === "saving" ? "Saving…" : "Not finding it? Tell us what you need"}
        </button>
        {error && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <div className="my-10 mx-auto max-w-[520px] text-center border border-border rounded-xl bg-surface p-7">
      <div className="font-lora text-lg font-bold mb-1.5">Nothing matching {label} right now</div>
      <p className="text-muted text-[13px] m-0 mb-5">
        Tell us what you&apos;re looking for and we&apos;ll go find it — you don&apos;t have to keep checking back.
      </p>
      <button type="button" onClick={() => void submit()} disabled={state === "saving"} className={primaryButtonClass}>
        {state === "saving" ? "Saving…" : "Tell us what you need"}
      </button>
      {error && <p className="text-[12px] text-danger mt-3 mb-0">{error}</p>}
      <p className="text-muted text-[11.5px] mt-4 mb-0">Or adjust the filters above to widen the search.</p>
    </div>
  );
}

const doneCardClass = "my-10 mx-auto max-w-[520px] text-center border border-green rounded-xl bg-surface p-7 text-[13.5px] font-bold text-green";

const primaryButtonClass =
  "bg-green text-on-green border-none rounded-lg px-5 py-2.5 text-[13.5px] font-bold cursor-pointer disabled:opacity-60";

const inlineButtonClass =
  "bg-transparent border-none p-0 text-[13px] font-bold text-green cursor-pointer underline disabled:opacity-60";
