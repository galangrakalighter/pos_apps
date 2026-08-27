import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface PendingSale {
  uuid: string;
  product_id: number;
  sold_quantity: number;
  price_cents: number;
  created_at: string;
  note: string | null;
}

export interface LocalSale {
  uuid: string; product_name: string; sold_quantity: number; price_cents: number;
  created_at: string; sync_status: 'pending' | 'synced';
}

export async function recordSale(ownerId: string, productId: number, quantity: number, note?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity');
  const db = await getDatabase();
  const uuid = Crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE local_products SET stock = stock - ?
       WHERE server_id = ? AND owner_id = ? AND is_active = 1 AND stock >= ?`,
      quantity,
      productId,
      ownerId,
      quantity,
    );
    if (result.changes !== 1) throw new Error('Insufficient local stock');

    const product = await transaction.getFirstAsync<{ price_cents: number }>(
      'SELECT price_cents FROM local_products WHERE server_id = ? AND owner_id = ? AND is_active = 1',
      productId,
      ownerId,
    );
    if (!product) throw new Error('Product not found');
    await transaction.runAsync(
      `INSERT INTO local_history
        (uuid, product_id, sold_quantity, price_cents, created_at, note, sync_status, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      uuid,
      productId,
      quantity,
      product.price_cents,
      createdAt,
      note ?? null,
      ownerId,
    );
  });
  return uuid;
}

export async function getPendingSales(ownerId: string, limit = 100): Promise<PendingSale[]> {
  const db = await getDatabase();
  return db.getAllAsync<PendingSale>(
    `SELECT uuid, product_id, sold_quantity, price_cents, created_at, note
       FROM local_history
      WHERE owner_id = ? AND sync_status = 'pending'
      ORDER BY created_at
      LIMIT ?`,
    ownerId,
    limit,
  );
}

export async function countPendingSales(ownerId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM local_history
      WHERE owner_id = ? AND sync_status = 'pending'`,
    ownerId,
  );
  return row?.total ?? 0;
}

export async function markSalesSynced(ownerId: string, uuids: string[]): Promise<void> {
  if (uuids.length === 0) return;
  const db = await getDatabase();
  const placeholders = uuids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE local_history SET sync_status = 'synced', synced_at = ?
      WHERE owner_id = ? AND uuid IN (${placeholders})`,
    new Date().toISOString(),
    ownerId,
    ...uuids,
  );
}

export async function getLocalSalesHistory(ownerId: string): Promise<LocalSale[]> {
  const db = await getDatabase();
  return db.getAllAsync<LocalSale>(
    `SELECT h.uuid, COALESCE(p.name, 'Produk') AS product_name, h.sold_quantity,
            h.price_cents, h.created_at, h.sync_status
       FROM local_history h
       LEFT JOIN local_products p ON p.server_id = h.product_id AND p.owner_id = h.owner_id
      WHERE h.owner_id = ?
      ORDER BY h.created_at DESC`,
    ownerId,
  );
}
