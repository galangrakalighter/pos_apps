import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { syncPartnerProducts } from '../products/products-sync';
import { Session } from '../types';
import { syncHistory } from './history-sync';
import { syncStockAdjustments } from './stock-adjustments-sync';
import { syncDiscounts } from '../discounts/discounts-api';

let running: Promise<void> | null = null;

async function request<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/sync-requests${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...init?.headers },
  });
  const body = await response.json().catch(() => null) as T | { message?: string | string[] } | null;
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
    throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Sinkronisasi gagal (${response.status})`);
  }
  return body as T;
}

export async function requestPartnerSync(session: Session, mitraId: string) {
  return request<{ id: string; status: string; requestedAt: string }>(session, `/partners/${mitraId}`, { method: 'POST' });
}

export function getPartnerSyncStatus(session: Session, requestId: string) {
  return request<{ id: string; status: 'pending' | 'processing' | 'completed' | 'failed'; error?: string | null }>(session, `/${requestId}`);
}

async function processTargetedSync(session: Session, onComplete?: () => void) {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return;
  const job = await request<{ id: string } | null>(session, '/claim', { method: 'POST' });
  if (!job) return;
  try {
    await syncStockAdjustments({ userId: session.mitraId, accessToken: session.accessToken });
    await syncHistory({ userId: session.id, accessToken: session.accessToken });
    await syncPartnerProducts(session);
    await syncDiscounts(session);
    await request(session, `/${job.id}/finish`, { method: 'PATCH', body: JSON.stringify({ success: true }) });
    onComplete?.();
  } catch (error) {
    await request(session, `/${job.id}/finish`, { method: 'PATCH', body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Terjadi kesalahan' }) }).catch(() => undefined);
  }
}

export function startTargetedSync(session: Session, onComplete?: () => void) {
  const trigger = () => {
    if (!running) running = processTargetedSync(session, onComplete).finally(() => { running = null; });
  };
  trigger();
  const networkSubscription = NetInfo.addEventListener((state) => { if (state.isConnected && state.isInternetReachable !== false) trigger(); });
  const timer = setInterval(trigger, 10000);
  return () => { networkSubscription(); clearInterval(timer); };
}
