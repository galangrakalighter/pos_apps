import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface PendingSale {
  uuid: string;
  product_id: number;
  sold_quantity: number;
  price_cents: number;
  created_at: string;
  note: string | null;
  transaction_uuid: string;
  payment_method: PaymentMethod;
  amount_paid_cents: number;
  change_cents: number;
  transaction_total_cents: number;
}

export type PaymentMethod = 'tunai' | 'qris' | 'transfer' | 'debit';

export interface LocalSale {
  uuid: string; product_name: string; sold_quantity: number; price_cents: number;
  created_at: string; sync_status: 'pending' | 'synced'; payment_method: PaymentMethod;
  transaction_uuid: string; transaction_total_cents: number; amount_paid_cents: number; change_cents: number;
  note: string | null;
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

export async function recordTransaction(
  ownerId: string,
  items: Array<{ productId: number; quantity: number }>,
  payment: { method: PaymentMethod; amountPaidCents: number; note?: string },
) {
  if (!items.length || items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) throw new Error('Keranjang tidak valid');
  const db = await getDatabase();
  const transactionUuid = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let totalCents = 0;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const pricedItems: Array<{ productId: number; quantity: number; priceCents: number }> = [];
    const ingredientRequirements = new Map<number, number>();
    for (const item of items) {
      const product = await transaction.getFirstAsync<{ price_cents: number; stock: number }>(
        `SELECT price_cents, stock FROM local_products
          WHERE server_id = ? AND owner_id = ? AND is_active = 1 AND product_kind = 'produk_jadi'`,
        item.productId, ownerId,
      );
      if (!product) throw new Error('Produk tidak ditemukan');
      if (product.stock < item.quantity) throw new Error('Stok produk tidak mencukupi');
      const recipes = await transaction.getAllAsync<{ ingredient_product_id: number; quantity_required: number }>(
        `SELECT ingredient_product_id, quantity_required
           FROM local_product_recipes
          WHERE owner_id = ? AND finished_product_id = ?`,
        ownerId, item.productId,
      );
      if (!recipes.length) throw new Error('Resep produk belum tersimpan. Minta Pusat melakukan sinkronisasi Mitra ini.');
      for (const recipe of recipes) {
        const required = Number(recipe.quantity_required) * item.quantity;
        ingredientRequirements.set(recipe.ingredient_product_id, (ingredientRequirements.get(recipe.ingredient_product_id) ?? 0) + required);
      }
      totalCents += product.price_cents * item.quantity;
      pricedItems.push({ ...item, priceCents: product.price_cents });
    }
    if (payment.method === 'tunai' && payment.amountPaidCents < totalCents) throw new Error('Nominal pembayaran tunai kurang');
    const amountPaidCents = payment.method === 'tunai' ? payment.amountPaidCents : totalCents;
    const changeCents = payment.method === 'tunai' ? amountPaidCents - totalCents : 0;

    for (const [ingredientId, required] of ingredientRequirements) {
      const changed = await transaction.runAsync(
        `UPDATE local_products SET stock = stock - ?
          WHERE server_id = ? AND owner_id = ? AND is_active = 1
            AND product_kind = 'bahan_baku' AND stock + 0.000001 >= ?`,
        required, ingredientId, ownerId, required,
      );
      if (changed.changes !== 1) throw new Error('Bahan baku tidak mencukupi untuk transaksi ini.');
    }

    // Stok produk jadi merupakan kapasitas yang dihitung dari bahan baku. Setelah
    // bahan dipotong, hitung ulang semua produk agar kasir langsung melihat stok lokal terbaru.
    const finishedProducts = await transaction.getAllAsync<{ server_id: number }>(
      `SELECT server_id FROM local_products
        WHERE owner_id = ? AND is_active = 1 AND product_kind = 'produk_jadi'`,
      ownerId,
    );
    for (const finished of finishedProducts) {
      const capacities = await transaction.getAllAsync<{ stock: number; quantity_required: number }>(
        `SELECT raw.stock, recipe.quantity_required
           FROM local_product_recipes recipe
           LEFT JOIN local_products raw
             ON raw.server_id = recipe.ingredient_product_id
            AND raw.owner_id = recipe.owner_id AND raw.is_active = 1
          WHERE recipe.owner_id = ? AND recipe.finished_product_id = ?`,
        ownerId, finished.server_id,
      );
      const capacity = capacities.length
        ? Math.max(0, Math.floor(Math.min(...capacities.map((row) => Number(row.stock ?? 0) / Number(row.quantity_required)))))
        : 0;
      await transaction.runAsync(
        `UPDATE local_products SET stock = ?, updated_at = ? WHERE server_id = ? AND owner_id = ?`,
        capacity, createdAt, finished.server_id, ownerId,
      );
    }

    for (const item of pricedItems) {
      await transaction.runAsync(
        `INSERT INTO local_history
          (uuid, product_id, sold_quantity, price_cents, created_at, note, sync_status, owner_id,
           transaction_uuid, payment_method, amount_paid_cents, change_cents, transaction_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(), item.productId, item.quantity, item.priceCents, createdAt,
        payment.note ?? 'Transaksi POS', ownerId, transactionUuid, payment.method,
        amountPaidCents, changeCents, totalCents,
      );
    }
  });
  return { transactionUuid, totalCents, changeCents: Math.max(0, payment.amountPaidCents - totalCents) };
}

export async function getPendingSales(ownerId: string, limit = 100): Promise<PendingSale[]> {
  const db = await getDatabase();
  return db.getAllAsync<PendingSale>(
    `SELECT uuid, product_id, sold_quantity, price_cents, created_at, note,
            COALESCE(transaction_uuid, uuid) AS transaction_uuid, payment_method,
            amount_paid_cents, change_cents, transaction_total_cents
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
            h.price_cents, h.created_at, h.sync_status, h.payment_method,
            COALESCE(h.transaction_uuid, h.uuid) AS transaction_uuid,
            h.transaction_total_cents, h.amount_paid_cents, h.change_cents, h.note
       FROM local_history h
       LEFT JOIN local_products p ON p.server_id = h.product_id AND p.owner_id = h.owner_id
      WHERE h.owner_id = ?
      ORDER BY h.created_at DESC`,
    ownerId,
  );
}
