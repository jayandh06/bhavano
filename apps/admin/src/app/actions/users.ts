"use server";

import { revalidatePath } from "next/cache";
import type { ListingOwnerDto, SendWelcomeResponseDto, WelcomeChannel } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { deleteUser, grantAgentPro, searchUsers, sendWelcome, setReraVerified } from "@/lib/bff";

export type ActionResult = { success: true } | { success: false; error: string };

/** Permanent removal — the caller should navigate away from /users/[id], which will 404 after.
 * Revalidates the list so the row's PII is gone there too. */
export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await deleteUser(accessToken, userId);
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete user" };
  }
}

/** Founding-broker offer: free Agent Pro, stacked on any time the agent already has. */
export async function grantFoundingBrokerProAction(userId: string, months: number): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await grantAgentPro(accessToken, userId, { months, reason: "founding_broker" });
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to grant Agent Pro" };
  }
}

export async function setReraVerifiedAction(userId: string, verified: boolean): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await setReraVerified(accessToken, userId, verified);
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update RERA status" };
  }
}

/** Backs UserPicker's live search. A read, not a mutation — swallows errors into an empty
 * result set rather than surfacing them, since a failed search just means "no matches yet"
 * from the picker's point of view. */
export async function searchUsersAction(q: string): Promise<ListingOwnerDto[]> {
  const { accessToken } = await requireAdmin();
  try {
    return await searchUsers(accessToken, q, 10);
  } catch {
    return [];
  }
}

/** Backs the Users page's bulk "Send welcome email"/"Send welcome WhatsApp" action — a
 * deliberate, unconditional resend the admin triggered for one or many selected rows at once. */
export async function sendWelcomeAction(
  userIds: string[],
  channel: WelcomeChannel,
): Promise<SendWelcomeResponseDto | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await sendWelcome(accessToken, { userIds, channel });
    revalidatePath("/users");
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send welcome" };
  }
}
