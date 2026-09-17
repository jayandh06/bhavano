"use server";

import type { CreateRequirementInput, RequirementDto } from "@bhavano/types";
import { auth } from "@/auth";
import { createRequirement } from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";

/** `needsLogin` is distinct from a plain error on purpose: the caller opens the login gate and
 * retries, rather than showing "you must be logged in" as a failure the visitor has to act on
 * themselves. */
export type CreateRequirementResult =
  | { success: true; requirement: RequirementDto }
  | { success: false; needsLogin: true }
  | { success: false; needsLogin?: false; error: string };

export async function createRequirementAction(input: CreateRequirementInput): Promise<CreateRequirementResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, needsLogin: true };
  }

  try {
    return { success: true, requirement: await createRequirement(session.accessToken, input) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save that just now" };
  }
}
