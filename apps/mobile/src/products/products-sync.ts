import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { getDatabase } from '../database/db';
import { Product, Session } from '../types';

type ServerProduct = { id: string; name: string; stock: number; price: string; category: string; imageUrl: string | null; updatedAt: string };
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
    for (const product of products) {
      await db.runAsync(
        `INSERT INTO local_products (server_id, name, stock, price_cents, category, image_url, updated_at, owner_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(server_id) DO UPDATE SET name=excluded.name, stock=excluded.stock,
           price_cents=excluded.price_cents, category=excluded.category,
           image_url=excluded.image_url, updated_at=excluded.updated_at,
           owner_id=excluded.owner_id, is_active=1`,
        Number(product.id), product.name, product.stock, Math.round(Number(product.price) * 100), product.category, absoluteImage(product.imageUrl), product.updatedAt, session.mitraId,
      );
    }
  });
}

export async function getLocalProducts(ownerId: string): Promise<Product[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ server_id: number; name: string; stock: number; price_cents: number; category: string; image_url: string | null }>(
    `SELECT server_id, name, stock, price_cents, category, image_url
       FROM local_products
      WHERE owner_id = ? AND is_active = 1
      ORDER BY name`,
    ownerId,
  );
  const colors = ['#FFE0DA', '#FDE6D2', '#F5F0C9', '#DCEEE9'];
  return rows.map((row, index) => ({ id: row.server_id, name: row.name, stock: row.stock, price: row.price_cents / 100, category: row.category, imageUrl: row.image_url, color: colors[index % colors.length] }));
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
