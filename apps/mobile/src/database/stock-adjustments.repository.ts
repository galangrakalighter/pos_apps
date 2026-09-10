import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface PendingStockAdjustment {
  uuid: string;
  product_id: number;
  delta: number;
  created_at: string;
}

export async function adjustLocalStock(ownerId: string, productId: number, delta: number) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.000001) throw new Error('Jumlah perubahan stok tidak valid');
  const db = await getDatabase();
  const uuid = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const product = await transaction.getFirstAsync<{ stock: number; product_kind: 'bahan_baku' | 'produk_jadi' }>(
      `SELECT stock, product_kind FROM local_products WHERE server_id = ? AND owner_id = ? AND is_active = 1`,
      productId, ownerId,
    );
    if (!product) throw new Error('Produk tidak ditemukan');
    if (Number(product.stock) + delta < -0.000001) throw new Error('Stok tidak mencukupi untuk dikurangi');
    await transaction.runAsync(
      `UPDATE local_products SET stock = MAX(0, stock + ?), updated_at = ? WHERE server_id = ? AND owner_id = ?`,
      delta, createdAt, productId, ownerId,
    );
    await transaction.runAsync(
      `INSERT INTO local_stock_adjustments (uuid, owner_id, product_id, delta, created_at, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      uuid, ownerId, productId, delta, createdAt,
    );
  });
  return uuid;
}

export async function getPendingStockAdjustments(ownerId: string, limit = 100) {
  const db = await getDatabase();
  return db.getAllAsync<PendingStockAdjustment>(
    `SELECT uuid, product_id, delta, created_at FROM local_stock_adjustments
      WHERE owner_id = ? AND sync_status = 'pending' ORDER BY created_at LIMIT ?`,
    ownerId, limit,
  );
}

export async function markStockAdjustmentsSynced(ownerId: string, uuids: string[]) {
  if (!uuids.length) return;
  const db = await getDatabase();
  const placeholders = uuids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE local_stock_adjustments SET sync_status = 'synced', synced_at = ?
      WHERE owner_id = ? AND uuid IN (${placeholders})`,
    new Date().toISOString(), ownerId, ...uuids,
  );
}
