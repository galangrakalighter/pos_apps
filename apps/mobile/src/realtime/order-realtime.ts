import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';
import { OrderStatus, RemoteOrder } from '../procurement/procurement-api';
import { Session } from '../types';

export type OrderRealtimeEvent =
  | { type: 'new'; order: RemoteOrder }
  | { type: 'status'; order: RemoteOrder & { status: OrderStatus } };

const listeners = new Set<(event: OrderRealtimeEvent) => void>();
let socket: Socket | null = null;

export function subscribeOrderRealtime(listener: (event: OrderRealtimeEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(event: OrderRealtimeEvent) {
  for (const listener of listeners) listener(event);
}

export function connectOrderRealtime(session: Session) {
  socket?.disconnect();
  const origin = API_URL.replace(/\/api\/v1\/?$/, '');
  socket = io(`${origin}/orders`, {
    auth: { token: session.accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  socket.on('orders:new', (order: RemoteOrder) => publish({ type: 'new', order }));
  socket.on('orders:status-changed', (order: RemoteOrder) => publish({ type: 'status', order }));
  return () => {
    socket?.disconnect();
    socket = null;
  };
}
