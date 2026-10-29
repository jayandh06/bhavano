"use client";

import { useState, useTransition } from "react";
import type { ContactSharePreferenceDto } from "@bhavano/types/seekerContact";
import { saveContactShareAction } from "@/app/actions/users";

/** Profile card: may owners of Featured ads this person shows interest in see their number. Shown only while an admin has the feature on. In notice mode it starts
 * on (and this is how to opt out); in opt-in mode it starts off. See docs/plans/featured-seeker-contact-for-owners.md. */
export function ContactShareCard({ preference }: { preference: ContactSharePreferenceDto }) {
  const [current, setCurrent] = useState(preference);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!current.enabled) return null;

  function change(sharing: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveContactShareAction(sharing);
      if (result.success && result.preference) setCurrent(result.preference);
      else setError(result.error ?? "Could not save");
    });
  }

  return (
    <section className="border border-border rounded-2xl p-6 bg-surface">
      <div className="font-lora text-lg font-bold text-text mb-1">Who can call you</div>
      <p className="text-[13px] text-muted m-0 mb-3">
        When you show interest in an ad, its owner can see your verified mobile number if their ad is Featured, or if they unlock it. You can turn that off any time.
      </p>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={current.sharing}
          disabled={pending}
          onChange={(e) => change(e.target.checked)}
        />
        <span className="text-[13.5px] text-text">Let owners of ads I show interest in call me</span>
      </label>
      {error && <p className="m-0 mt-2 text-[13px] text-[#b3413a]">{error}</p>}
    </section>
  );
}
