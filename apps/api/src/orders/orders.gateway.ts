import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '../auth/auth.types';

@WebSocketGateway({ namespace: '/orders', cors: { origin: true, credentials: true } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string') return client.disconnect(true);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      await client.join(this.userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  notifyNewOrder(recipientId: string, order: unknown) {
    this.server.to(this.userRoom(recipientId)).emit('orders:new', order);
  }

  notifyStatusChanged(requesterId: string, order: unknown) {
    this.server.to(this.userRoom(requesterId)).emit('orders:status-changed', order);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
