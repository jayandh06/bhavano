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
import type { MessageDto } from '@bhavano/types';

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/** Push-only channel — REST (MessagingController) is the source of truth for persistence.
 * Clients join a room per conversation and receive `new_message` events emitted after
 * the REST send-message call actually saves to the DB. */
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
      jwt.verify(token, secret);
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
}
