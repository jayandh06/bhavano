import { attributeTarget, type DetailsIssue } from "@bhavano/types/postDetailsIssues";

/** How a required field is drawn on the redesigned post-ad form (docs/plans/post-ad-simpler-form.md): `empty` is a soft red border, from the
 * moment the form opens, so the sellers can see at once which fields they must fill; `error` is a solid red border (the field has been left
 * empty after a visit, Preview was tapped, or the value has to change) and comes with its message; `ok` is a green border, because the field is
 * filled and valid. Optional fields have no state and stay neutral. */
export type RequiredState = "empty" | "error" | "ok";

/** The state of one required field, from the problem found for it (if any). `messageShown` is whether its red message is already on screen. */
export function requiredState(issue: DetailsIssue | undefined, messageShown: boolean): RequiredState {
  if (!issue) return "ok";
  // A value that has to change is wrong, not just missing, so it is solid red straight away.
  if (!issue.missing) return "error";
  return messageShown ? "error" : "empty";
}

/** The problem for a wizard-level target (location, price, photos, title, description), if there is one. */
export function issueForTarget(issues: DetailsIssue[], target: string): DetailsIssue | undefined {
  return issues.find((issue) => issue.target === target);
}

/** The state of every required category field, keyed by field key. "Posted by" is reported under its own target, so it is looked up there too. */
export function requiredAttributeStates(
  requiredKeys: string[],
  issues: DetailsIssue[],
  shownMessages: Record<string, string>,
): Record<string, RequiredState> {
  const states: Record<string, RequiredState> = {};
  for (const key of requiredKeys) {
    const targets = key === "fromBroker" ? ["posted_by", attributeTarget(key)] : [attributeTarget(key)];
    const target = targets.find((t) => issues.some((issue) => issue.target === t));
    states[key] = requiredState(target ? issueForTarget(issues, target) : undefined, target ? target in shownMessages : false);
  }
  return states;
}
