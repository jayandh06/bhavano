"use client";

import { useState } from "react";
import { PlanComparisonTable } from "@/components/home/PlanComparisonTable";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

type Tab = "compare" | "subscribe";

/** Logged-out visitors can read the comparison; subscribing requires login. */
export function PremiumPlansPublic() {
  const [tab, setTab] = useState<Tab>("compare");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 p-1 bg-surface-alt border border-border rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("compare")}
          className={`px-4 py-2 text-[13px] font-bold rounded-lg cursor-pointer border-0 ${
            tab === "compare" ? "bg-surface text-text shadow-sm" : "bg-transparent text-muted"
          }`}
        >
          Compare plans
        </button>
        <button
          type="button"
          onClick={() => setTab("subscribe")}
          className={`px-4 py-2 text-[13px] font-bold rounded-lg cursor-pointer border-0 ${
            tab === "subscribe" ? "bg-surface text-text shadow-sm" : "bg-transparent text-muted"
          }`}
        >
          Subscribe
        </button>
      </div>

      {tab === "compare" ? (
        <PlanComparisonTable profile={null} />
      ) : (
        <RequireLoginPrompt message="Log in to purchase a plan and see which tier you're on today." />
      )}
    </div>
  );
}
