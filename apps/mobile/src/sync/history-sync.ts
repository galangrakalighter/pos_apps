import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { getPendingSales, markSalesSynced } from '../database/sales.repository';

export interface SyncSession {
  userId: string;
  accessToken?: string;
}

const activeSyncs = new Map<string, Promise<void>>();

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

async function performSync(session: SyncSession): Promise<void> {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return;

  // Drain bounded batches. If the app dies after the server commit but before the
  // local update, the next attempt resends UUIDs and the API safely deduplicates.
  for (;;) {
    const pending = await getPendingSales(session.userId, 100);
    if (pending.length === 0) return;

    const response = await fetch(`${API_URL}/history/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : { 'x-user-id': session.userId }),
      },
      body: JSON.stringify({
        items: pending.map((sale) => ({
          uuid: sale.uuid,
          productId: String(sale.product_id),
          soldQuantity: sale.sold_quantity,
          price: centsToDecimal(sale.price_cents),
          createdAt: sale.created_at,
          note: sale.note ?? undefined,
        })),
      }),
    });
    if (!response.ok) throw new Error(`History sync failed (${response.status})`);

    const result = (await response.json()) as { acknowledgedUuids: string[] };
    await markSalesSynced(session.userId, result.acknowledgedUuids);
    if (result.acknowledgedUuids.length < pending.length) return;
  }
}

export function syncHistory(session: SyncSession): Promise<void> {
  // Mutex per Mitra prevents concurrent sync without mixing queues between accounts.
  const running = activeSyncs.get(session.userId);
  if (running) return running;
  const next = performSync(session).finally(() => { activeSyncs.delete(session.userId); });
  activeSyncs.set(session.userId, next);
  return next;
}

export function startHistorySync(session: SyncSession, onComplete?: () => void): () => void {
  const trigger = () => void syncHistory(session).then(onComplete).catch(() => undefined);
  trigger();
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      trigger();
    }
  });
}
