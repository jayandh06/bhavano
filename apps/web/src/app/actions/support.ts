"use server";

import { auth } from "@/auth";
import { submitSupportTicket } from "@/lib/bff";

export type SupportTicketActionResult =
  | { success: true; ticketId: string }
  | { success: false; error: string };

/** Takes the raw FormData so attachments survive the hop — reconstructing it field by field
 * would mean buffering every file through this process twice.
 *
 * `userId` is attached here rather than trusted from the client: the browser never reaches the
 * BFF directly, so a value stamped on server-side from the NextAuth session is authoritative. */
export async function submitSupportTicketAction(formData: FormData): Promise<SupportTicketActionResult> {
  try {
    const session = await auth();
    if (session?.user?.id) formData.set("userId", session.user.id);

    const { ticketId } = await submitSupportTicket(formData);
    return { success: true, ticketId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Couldn't send your message. Please try again.",
    };
  }
}
