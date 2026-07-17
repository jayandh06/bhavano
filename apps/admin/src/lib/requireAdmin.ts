import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export interface AdminSession {
  accessToken: string;
  userId: string;
}

/** Every admin page calls this first — bounces anyone without a valid admin session back
 * to /login rather than ever rendering moderation content for a non-admin. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.accessToken || session.role !== "admin" || !session.user?.id) {
    redirect("/login?error=unauthorized");
  }
  return { accessToken: session.accessToken, userId: session.user.id };
}
