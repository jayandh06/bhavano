"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { recordShareTap } from "@/lib/bff";
import { cookieName } from "@/lib/cookieNames";

/** Fire-and-forget from a client component's share button — see ReferralsService.recordShareTap's
 * own doc comment. Silently does nothing for a logged-out visitor (no accessToken) or a missing
 * session cookie: a dropped share-tap log must never surface as an error on the share button
 * itself, same stance every other best-effort analytics call in this app takes. */
export async function recordShareTapAction(
  listingId?: string,
  channel?: "whatsapp" | "copy" | "share_sheet" | "email" | "facebook",
): Promise<void> {
  const session = await auth();
  if (!session?.accessToken) return;
  const sessionId = (await cookies()).get(cookieName("bhavano_sid"))?.value;
  if (!sessionId) return;
  await recordShareTap(session.accessToken, sessionId, listingId, channel).catch(() => undefined);
}
