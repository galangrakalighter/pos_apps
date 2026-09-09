import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { getPendingStockAdjustments, markStockAdjustmentsSynced } from '../database/stock-adjustments.repository';
import { SyncSession } from './history-sync';

const active = new Map<string, Promise<void>>();

async function perform(session: SyncSession) {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return;
  for (;;) {
    const pending = await getPendingStockAdjustments(session.userId, 100);
    if (!pending.length) return;
    const response = await fetch(`${API_URL}/products/stock-adjustments/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}) },
      body: JSON.stringify({ items: pending.map((item) => ({ uuid: item.uuid, productId: String(item.product_id), delta: item.delta, createdAt: item.created_at })) }),
    });
    const body = await response.json().catch(() => null) as { acknowledgedUuids?: string[]; message?: string | string[] } | null;
    if (!response.ok) {
      const detail = body?.message;
      throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Sinkronisasi stok gagal (${response.status})`);
    }
    const acknowledged = body?.acknowledgedUuids ?? [];
    await markStockAdjustmentsSynced(session.userId, acknowledged);
    if (acknowledged.length < pending.length) return;
  }
}

export function syncStockAdjustments(session: SyncSession) {
  const running = active.get(session.userId);
  if (running) return running;
  const next = perform(session).finally(() => active.delete(session.userId));
  active.set(session.userId, next);
  return next;
}
