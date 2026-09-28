import type { RequirementCaptureCriteria, RequirementDto } from "@bhavano/types";

/**
 * Hands a capture from the home screen's `RequirementPrompt` to the `/requirement/new` questions
 * screen and the created requirement back again. In memory rather than route params: the criteria
 * are a nested object, and nothing here needs to survive the app being killed — a requirement is
 * only created at the end of the questions, so a lost draft just means starting again.
 */
export interface RequirementDraft {
  criteria: RequirementCaptureCriteria & { cityId: string };
  /** The card's label — kept as the row's `originalSearchLabel`. */
  label: string;
  cityName?: string;
  contactConsent: boolean;
}

let pending: RequirementDraft | null = null;
let created: RequirementDto | null = null;

export function startRequirementDraft(draft: RequirementDraft): void {
  pending = draft;
  created = null;
}

export function pendingRequirementDraft(): RequirementDraft | null {
  return pending;
}

export function finishRequirementDraft(requirement: RequirementDto): void {
  pending = null;
  created = requirement;
}

/** The requirement the questions just created, once — null if they were left without finishing. */
export function takeCreatedRequirement(): RequirementDto | null {
  const requirement = created;
  created = null;
  return requirement;
}
