import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { getDatabase } from '../database/db';
import { Product, Session } from '../types';

type ServerRecipe = { ingredientProductId: string | null; quantityRequired: number };
type ServerProduct = { id: string; name: string; stock: number; price: string; category: string; kind: 'bahan_baku' | 'produk_jadi'; unit: string | null; recipeComplete: boolean; recipes?: ServerRecipe[]; imageUrl: string | null; updatedAt: string };
const absoluteImage = (path: string | null) => path ? `${API_URL.replace(/\/api\/v1\/?$/, '')}${path}` : null;

export async function syncPartnerProducts(session: Session) {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return;
  const response = await fetch(`${API_URL}/products/mine`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (!response.ok) throw new Error(`Sinkronisasi produk gagal (${response.status})`);
  const products = await response.json() as ServerProduct[];
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE local_products SET is_active = 0 WHERE owner_id = ?`, session.mitraId);
    await db.runAsync(`DELETE FROM local_product_recipes WHERE owner_id = ?`, session.mitraId);
    for (const product of products) {
      await db.runAsync(
        `INSERT INTO local_products (server_id, name, stock, price_cents, category, product_kind, unit, recipe_complete, image_url, updated_at, owner_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(server_id) DO UPDATE SET name=excluded.name, stock=excluded.stock,
           price_cents=excluded.price_cents, category=excluded.category, product_kind=excluded.product_kind,
           unit=excluded.unit, recipe_complete=excluded.recipe_complete,
           image_url=excluded.image_url, updated_at=excluded.updated_at,
           owner_id=excluded.owner_id, is_active=1`,
        Number(product.id), product.name, product.stock, Math.round(Number(product.price) * 100), product.category, product.kind, product.unit, product.recipeComplete ? 1 : 0, absoluteImage(product.imageUrl), product.updatedAt, session.mitraId,
      );
      for (const recipe of product.recipes ?? []) {
        if (!recipe.ingredientProductId || !Number.isFinite(Number(recipe.quantityRequired)) || Number(recipe.quantityRequired) <= 0) continue;
        await db.runAsync(
          `INSERT INTO local_product_recipes
            (owner_id, finished_product_id, ingredient_product_id, quantity_required)
           VALUES (?, ?, ?, ?)`,
          session.mitraId, Number(product.id), Number(recipe.ingredientProductId), Number(recipe.quantityRequired),
        );
      }
    }
  });
}

/**
 * Mengisi database perangkat baru tanpa mengubah aturan sinkronisasi manual.
 * Snapshot server hanya diambil otomatis ketika akun ini sama sekali belum
 * mempunyai katalog aktif di SQLite, sehingga stok offline yang sudah berubah
 * dan transaksi pending tidak tertimpa snapshot lama dari pusat.
 */
export async function ensureLocalPartnerProducts(session: Session): Promise<void> {
  const db = await getDatabase();
  const local = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM local_products WHERE owner_id = ? AND is_active = 1`,
    session.mitraId,
  );
  if ((local?.total ?? 0) > 0) return;
  await syncPartnerProducts(session);
}

export async function getLocalProducts(ownerId: string, kind?: 'bahan_baku' | 'produk_jadi'): Promise<Product[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ server_id: number; name: string; stock: number; price_cents: number; category: string; product_kind: 'bahan_baku' | 'produk_jadi'; unit: string | null; recipe_complete: number; image_url: string | null }>(
    `SELECT server_id, name, stock, price_cents, category, product_kind, unit, recipe_complete, image_url
       FROM local_products
      WHERE owner_id = ? AND is_active = 1 AND (? IS NULL OR product_kind = ?)
      ORDER BY name`,
    ownerId, kind ?? null, kind ?? null,
  );
  const colors = ['#FFE0DA', '#FDE6D2', '#F5F0C9', '#DCEEE9'];
  return rows.map((row, index) => ({ id: row.server_id, name: row.name, stock: row.stock, price: row.price_cents / 100, category: row.category, kind: row.product_kind, unit: row.unit, recipeComplete: Boolean(row.recipe_complete), imageUrl: row.image_url, color: colors[index % colors.length] }));
}

export async function updatePartnerProductPrice(session: Session, productId: number, price: number) {
  const response = await fetch(`${API_URL}/products/${productId}/price`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ price: String(price) }),
  });
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) { const detail = body?.message; throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Harga gagal disimpan (${response.status})`); }
  const db = await getDatabase();
  await db.runAsync(`UPDATE local_products SET price_cents = ?, updated_at = ? WHERE server_id = ? AND owner_id = ?`, Math.round(price * 100), new Date().toISOString(), productId, session.mitraId);
}

export async function updateFinishedProduct(session: Session, productId: number, stock: number, price?: number) {
  const response = await fetch(`${API_URL}/products/${productId}/finished-stock`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ stock, price: price === undefined ? undefined : String(price) }),
  });
  const body = await response.json().catch(() => null) as { message?: string | string[]; stock?: number; price?: string } | null;
  if (!response.ok) { const detail = body?.message; throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Stok gagal disimpan (${response.status})`); }
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE local_products SET stock = ?, price_cents = COALESCE(?, price_cents), updated_at = ? WHERE server_id = ? AND owner_id = ? AND product_kind = 'produk_jadi'`,
    stock, price === undefined ? null : Math.round(price * 100), new Date().toISOString(), productId, session.mitraId,
  );
}
