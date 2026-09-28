"use client";

import { useRouter } from "next/navigation";
import type { RequirementDto } from "@bhavano/types";
import { RequirementRefineWizard } from "./RequirementRefineWizard";

/** The refinement questions as a page — for the "Finish details" link on /my-requirements and for
 * a reminder that links straight here. Finishing or closing both go back to the list, since every
 * answer is saved as it is given. */
export function RequirementRefinePage({ requirement }: { requirement: RequirementDto }) {
  const router = useRouter();
  const back = () => {
    router.push("/my-requirements");
    router.refresh();
  };
  return (
    <div className="w-full border border-border rounded-xl bg-surface p-5 sm:p-8">
      <RequirementRefineWizard
        requirement={requirement}
        mode={{ kind: "refine", id: requirement.id }}
        onFinished={back}
        onClose={back}
      />
    </div>
  );
}
