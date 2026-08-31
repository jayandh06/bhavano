import type { Metadata } from "next";
import { auth } from "@/auth";
import { isAccessTokenValid } from "@/lib/session";
import { AuthPopupComplete } from "@/components/home/AuthPopupComplete";

/** Nothing here is for a reader, and the page exists for a few hundred milliseconds. */
export const metadata: Metadata = {
  title: "Signing in — Bhavano",
  robots: { index: false, follow: false },
};

/** Where Google's callback lands inside the popup. The session is read here, on the server,
 * rather than assumed from having arrived — see `AuthPopupComplete`. */
export default async function AuthCompletePage() {
  const session = await auth();
  return <AuthPopupComplete ok={isAccessTokenValid(session?.accessToken)} />;
}
