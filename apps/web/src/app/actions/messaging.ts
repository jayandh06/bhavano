"use server";

import type { MessageDto } from "@bhavano/types";
import { auth } from "@/auth";
import { BffAuthError, deleteMessage, fetchUnreadCount, markConversationRead, sendFirstMessage, sendMessage } from "@/lib/bff";

export type SendFirstMessageResult =
  | { requiresLogin: true }
  | { requiresLogin: false; conversationId: string; message: MessageDto }
  | { requiresLogin: false; error: string };

/** Starts a conversation and sends its first message atomically — see
 * docs/plans/message-delete-and-lazy-conversation-creation.md. There is no separate
 * "start conversation" step any more: a Conversation row only ever comes into existence
 * alongside its first Message. */
export async function sendFirstMessageAction(listingId: string, body: string): Promise<SendFirstMessageResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };

  try {
    const result = await sendFirstMessage(session.accessToken, listingId, body);
    return { requiresLogin: false, ...result };
  } catch (error) {
    if (error instanceof BffAuthError) return { requiresLogin: true };
    return { requiresLogin: false, error: error instanceof Error ? error.message : "Failed to send message" };
  }
}

export type DeleteMessageResult = { requiresLogin: true } | { requiresLogin: false };

export async function deleteMessageAction(messageId: string): Promise<DeleteMessageResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };

  try {
    await deleteMessage(session.accessToken, messageId);
    return { requiresLogin: false };
  } catch (error) {
    if (error instanceof BffAuthError) return { requiresLogin: true };
    throw error;
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

/** Read on mount by the header's Messages count badge. Returns 0 (not an error) for a
 * logged-out or stale session — the badge simply shows nothing. */
export async function getUnreadCountAction(): Promise<{ count: number }> {
  const session = await auth();
  if (!session?.accessToken) return { count: 0 };
  try {
    return await fetchUnreadCount(session.accessToken);
  } catch {
    return { count: 0 };
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
