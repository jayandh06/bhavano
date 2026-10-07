"use server";

import type { AiGenerateUsageDto, GenerateListingCopyInput, GenerateListingCopyResult } from "@bhavano/types/listingCopyAssist";
import { auth } from "@/auth";
import { fetchAiGenerateUsage, generateListingCopy } from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";
import { NEEDS_LOGIN_ERROR } from "@/lib/postAdErrors";

export type GenerateListingCopyActionResult =
  | { success: true; result: GenerateListingCopyResult }
  | { success: false; error: string };

/** Backs the wizard's "N left today" label, fetched once when the details step is reached (and
 * nudged locally after each generate attempt — see handleGenerateCopy) rather than letting a
 * seller only find out they're capped from a failed generate call. `null` (not a thrown error) on
 * any failure, including no session yet: this is a courtesy label, not something worth surfacing
 * its own error UI for. */
export async function fetchAiGenerateUsageAction(): Promise<AiGenerateUsageDto | null> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) return null;
  try {
    return await fetchAiGenerateUsage(session.accessToken);
  } catch {
    return null;
  }
}

/** Backs the posting wizard's "Generate" buttons (title/description) and the post-boost
 * "regenerate with Featured" banner — see docs/plans/ai-listing-copy-assist.md. Always requires
 * a real session, unlike createListingAction: the BFF endpoint is AuthGuard-only. */
export async function generateListingCopyAction(input: GenerateListingCopyInput): Promise<GenerateListingCopyActionResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: NEEDS_LOGIN_ERROR };
  }

  try {
    const result = await generateListingCopy(input, session.accessToken);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate" };
  }
}
