"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SellerType } from "@bhavano/types";
import { updateProfileAction } from "@/app/actions/users";

/** Asked once, of a signed-in account with no seller type, no listings and no Agent Pro. The answer
 * is saved to the profile, so the post-ad form stops asking it too. */
export function RequirementsRoleQuestion() {
  const router = useRouter();
  const [saving, setSaving] = useState<SellerType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(sellerType: SellerType) {
    setSaving(sellerType);
    setError(null);
    const result = await updateProfileAction({ sellerType });
    if (result.success) {
      router.refresh();
      return;
    }
    setSaving(null);
    setError(result.error ?? "That didn't save. Please try again.");
  }

  const button = "rounded-lg px-5 py-3 text-sm font-bold cursor-pointer border disabled:opacity-60";
  return (
    <div className="border border-border rounded-xl bg-surface p-6 mb-6 max-w-[640px]">
      <div className="font-bold text-[15px] mb-1">Requirements are for owners and agents</div>
      <p className="text-[13.5px] text-muted m-0 mb-4">Which describes you?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving !== null} onClick={() => choose("owner")} className={`${button} bg-green text-on-green border-green`}>
          {saving === "owner" ? "Saving…" : "I own property"}
        </button>
        <button type="button" disabled={saving !== null} onClick={() => choose("agent")} className={`${button} bg-green text-on-green border-green`}>
          {saving === "agent" ? "Saving…" : "I'm an agent"}
        </button>
        <Link href="/my-requirements" className={`${button} bg-surface text-text-soft border-border no-underline`}>
          I&apos;m looking for property
        </Link>
      </div>
      {error && <p className="text-[13px] text-red-600 m-0 mt-3">{error}</p>}
    </div>
  );
}
