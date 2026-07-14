"use server";

import { auth } from "@/auth";
import { createConversation, markConversationRead, sendMessage } from "@/lib/bff";

export type StartConversationResult =
  | { requiresLogin: true }
  | { requiresLogin: false; conversationId: string }
  | { requiresLogin: false; error: string };

export async function startConversationAction(listingId: string): Promise<StartConversationResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };

  try {
    const conversation = await createConversation(session.accessToken, listingId);
    return { requiresLogin: false, conversationId: conversation.id };
  } catch (error) {
    return { requiresLogin: false, error: error instanceof Error ? error.message : "Failed to start conversation" };
  }
}

export async function sendMessageAction(conversationId: string, body: string): Promise<void> {
  const session = await auth();
  if (!session?.accessToken) return;
  await sendMessage(session.accessToken, conversationId, body);
}

export async function markReadAction(conversationId: string): Promise<void> {
  const session = await auth();
  if (!session?.accessToken) return;
  await markConversationRead(session.accessToken, conversationId);
}
