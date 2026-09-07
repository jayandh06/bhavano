"use server";

import { revalidatePath } from "next/cache";
import type { ListingOwnerDto, SendWelcomeResponseDto, WelcomeChannel } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { searchUsers, sendWelcome } from "@/lib/bff";

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
