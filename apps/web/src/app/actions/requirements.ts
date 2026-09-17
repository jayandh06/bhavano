"use server";

import { revalidatePath } from "next/cache";
import type { CreateRequirementInput, RequirementDto, UpdateMyRequirementInput } from "@bhavano/types";
import { auth } from "@/auth";
import { closeMyRequirement, createRequirement, renewMyRequirement, updateMyRequirement } from "@/lib/bff";
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

export type RequirementActionResult =
  | { success: true; requirement: RequirementDto }
  | { success: false; error: string };

async function mutate(run: (token: string) => Promise<RequirementDto>): Promise<RequirementActionResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: "Please sign in again." };
  }
  try {
    const requirement = await run(session.accessToken);
    revalidatePath("/my-requirements");
    return { success: true, requirement };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "That didn't work — try again" };
  }
}

export async function renewRequirementAction(id: string): Promise<RequirementActionResult> {
  return mutate((token) => renewMyRequirement(token, id));
}

export async function closeRequirementAction(
  id: string,
  reason: "fulfilled" | "withdrawn",
): Promise<RequirementActionResult> {
  return mutate((token) => closeMyRequirement(token, id, reason));
}

export async function updateRequirementDetailsAction(
  id: string,
  input: UpdateMyRequirementInput,
): Promise<RequirementActionResult> {
  return mutate((token) => updateMyRequirement(token, id, input));
}
