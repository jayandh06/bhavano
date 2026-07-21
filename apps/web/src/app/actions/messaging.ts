"use server";

import { auth } from "@/auth";
import { BffAuthError, createConversation, markConversationRead, sendMessage } from "@/lib/bff";

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
    if (error instanceof BffAuthError) return { requiresLogin: true };
    return { requiresLogin: false, error: error instanceof Error ? error.message : "Failed to start conversation" };
  }
}

export type SendMessageResult = { requiresLogin: true } | { requiresLogin: false };

export async function sendMessageAction(conversationId: string, body: string): Promise<SendMessageResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };

  try {
    await sendMessage(session.accessToken, conversationId, body);
    return { requiresLogin: false };
  } catch (error) {
    if (error instanceof BffAuthError) return { requiresLogin: true };
    throw error;
  }
}

export async function markReadAction(conversationId: string): Promise<SendMessageResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };

  try {
    await markConversationRead(session.accessToken, conversationId);
    return { requiresLogin: false };
  } catch (error) {
    if (error instanceof BffAuthError) return { requiresLogin: true };
    throw error;
  }
}
