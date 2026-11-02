"use server";

import type { PostFeedbackDto, SavePostFeedbackRequest } from "@bhavano/types/postFeedback";
import { auth } from "@/auth";
import { savePostFeedback } from "@/lib/bff";

export type SavePostFeedbackResult = { success: true; feedback: PostFeedbackDto } | { success: false; error: string };

/** Saves one step of the post-ad feedback form (a star tap, the chips, the text). The owner is the logged-in user; the BFF checks
 * that the listing is theirs. See docs/plans/post-ad-experience-feedback.md. */
export async function savePostFeedbackAction(body: SavePostFeedbackRequest): Promise<SavePostFeedbackResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };
  try {
    return { success: true, feedback: await savePostFeedback(session.accessToken, { ...body, platform: "web" }) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save your feedback" };
  }
}
