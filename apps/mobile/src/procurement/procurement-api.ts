import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { Session } from '../types';

export interface ProcurementLine { warehouseId: number; quantity: number; }
export type OrderStatus = 'pending' | 'diterima' | 'dikirim' | 'selesai';
export interface RemoteOrderItem {
  id: string; warehouseId: string; namaBarang: string; jumlahPesan: number; unitPrice: string; lineTotal: string;
}
export interface RemoteOrder {
  id: string; pemesanId: string; pemberiId: string; status: OrderStatus;
  totalAmount: string; createdAt: string; updatedAt: string; items: RemoteOrderItem[];
  requesterUsername?: string;
}

async function orderRequest<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/orders${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...init?.headers },
  });
  const payload = await response.json().catch(() => null) as T | { message?: string | string[] } | null;
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'message' in payload ? payload.message : undefined;
    throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Permintaan pesanan gagal (${response.status})`);
  }
  return payload as T;
}

export const getMyOrders = (session: Session) => orderRequest<RemoteOrder[]>(session, '/mine');
export const getIncomingOrders = (session: Session) => orderRequest<RemoteOrder[]>(session, '/incoming');
export const updateOrderStatus = (session: Session, orderId: string, status: OrderStatus) =>
  orderRequest<RemoteOrder>(session, `/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

export async function createProcurementOrder(session: Session, items: ProcurementLine[]) {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error('Untuk memesan ke pusat dibutuhkan akses internet.');
  }
  return orderRequest<RemoteOrder>(session, '', {
    method: 'POST',
    body: JSON.stringify({ supplierId: session.centralSupplierId ?? undefined, items: items.map((item) => ({ warehouseId: String(item.warehouseId), quantity: item.quantity })) }),
  });
}
