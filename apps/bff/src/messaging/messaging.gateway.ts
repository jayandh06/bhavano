import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import type { MessageDto, UnreadUpdateEvent } from '@bhavano/types';

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/** Per-user room, joined automatically on connect — every device this user has open is in it, so
 * an `unread_update` reaches all of them (the count badge in one tab clears when they read a
 * thread in another). Distinct from the per-conversation rooms, which only the open thread view joins. */
function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Push-only channel — REST (MessagingController) is the source of truth for persistence.
 * Clients join a room per conversation and receive `new_message` events emitted after
 * the REST send-message call actually saves to the DB. They are also auto-joined to their own
 * `user:<id>` room for `unread_update` events (the Messages count badge). */
@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    const secret = this.config.get<string>('AUTH_JWT_SECRET') ?? 'dev-only-change-me';
    try {
      if (!token) throw new Error('missing token');
      const payload = jwt.verify(token, secret) as { sub?: string };
      // `Socket#join` is sync for the default in-memory adapter but typed `void | Promise<void>`.
      if (payload.sub) void client.join(userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join_conversation')
  onJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }): void {
    client.join(roomName(data.conversationId));
  }

  broadcastMessage(conversationId: string, message: MessageDto): void {
    this.server.to(roomName(conversationId)).emit('new_message', message);
  }

  /** Tells `userId`'s open clients their unread total just changed — `unreadCount` is the fresh
   * absolute value, not a delta, so a client sets the badge straight to it. */
  notifyUnread(userId: string, payload: UnreadUpdateEvent): void {
    this.server.to(userRoom(userId)).emit('unread_update', payload);
  }
}
