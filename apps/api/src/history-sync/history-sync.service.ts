import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HistoryItemDto, SyncHistoryResult } from './dto/sync-history.dto';

@Injectable()
export class HistorySyncService {
  constructor(private readonly dataSource: DataSource) {}

  async sync(mitraId: string, items: HistoryItemDto[]): Promise<SyncHistoryResult> {
    if (items.length === 0) return { acknowledgedUuids: [] };

    // One statement and one transaction: a retry after timeout is harmless because
    // uuid is globally unique. The ownership composite FK prevents tenant leakage.
    const values: unknown[] = [];
    const rows = items.map((item, index) => {
      const offset = index * 7;
      values.push(
        item.uuid,
        mitraId,
        item.productId,
        item.soldQuantity,
        item.price,
        item.createdAt,
        item.note ?? null,
      );
      return `($${offset + 1}::uuid, $${offset + 2}::uuid, $${offset + 3}::bigint,
        $${offset + 4}::integer, $${offset + 5}::numeric, $${offset + 6}::timestamptz,
        $${offset + 7}::text)`;
    });

    await this.dataSource.transaction(async (manager) => {
      const productIds = [...new Set(items.map((item) => String(item.productId)))];
      const sellable: Array<{ id: string }> = await manager.query(
        `SELECT id::text FROM produk_mitra
          WHERE mitra_id = $1::uuid AND jenis_produk = 'produk_jadi' AND harga > 0
            AND EXISTS (SELECT 1 FROM product_recipes r WHERE r.finished_product_id = produk_mitra.master_produk_id)
            AND id = ANY($2::bigint[])`, [mitraId, productIds],
      );
      if (sellable.length !== productIds.length) {
        throw new ConflictException('Hanya produk jadi milik Mitra yang dapat dijual melalui POS');
      }
      const rawInserted: unknown = await manager.query(
        `INSERT INTO history
          (uuid, mitra_id, id_produk, terjual, harga, created_at, keterangan)
         VALUES ${rows.join(',')}
         ON CONFLICT (uuid) DO NOTHING
         RETURNING uuid::text, id_produk::text AS product_id, terjual`,
        values,
      );
      const inserted = this.resultRows<{ uuid: string; product_id: string; terjual: number }>(rawInserted);
      const soldByProduct = new Map<string, number>();
      for (const row of inserted) soldByProduct.set(row.product_id, (soldByProduct.get(row.product_id) ?? 0) + row.terjual);
      for (const [productId, quantity] of soldByProduct) {
        const requirements: Array<{ rawId: string | null; ingredient: string; required: number }> = await manager.query(
          `SELECT raw.id::text AS "rawId", ingredient.nama_bumbu AS ingredient,
                  (convert_inventory_unit(r.quantity_required, r.satuan, ingredient.satuan) * $1)::float8 AS required
             FROM produk_mitra finished
             JOIN product_recipes r ON r.finished_product_id = finished.master_produk_id
             JOIN warehouse ingredient ON ingredient.id = r.ingredient_id
             LEFT JOIN produk_mitra raw ON raw.mitra_id = finished.mitra_id
               AND raw.master_produk_id = r.ingredient_id AND raw.jenis_produk = 'bahan_baku'
            WHERE finished.id = $2::bigint AND finished.mitra_id = $3::uuid
            ORDER BY r.ingredient_id`,
          [quantity, productId, mitraId],
        );
        if (!requirements.length || requirements.some((item) => !item.rawId)) throw new ConflictException(`Resep atau bahan baku produk ${productId} belum lengkap`);
        for (const requirement of requirements) {
          const rawUpdated: unknown = await manager.query(
            `UPDATE produk_mitra SET stock = stock - $1::numeric, updated_at = now()
              WHERE id = $2::bigint AND mitra_id = $3::uuid AND stock >= $1::numeric RETURNING id::text`,
            [requirement.required, requirement.rawId!, mitraId],
          );
          if (this.resultRows<{ id: string }>(rawUpdated).length !== 1) throw new ConflictException(`Bahan baku ${requirement.ingredient} tidak mencukupi`);
        }
      }
      if (inserted.length) {
        await manager.query(
          `UPDATE history SET stock_applied_at = now()
            WHERE mitra_id = $1::uuid AND uuid = ANY($2::uuid[])`,
          [mitraId, inserted.map((row) => row.uuid)],
        );
      }
    });

    // Acknowledge both inserted rows and legitimate duplicates owned by this tenant.
    // Never acknowledge a UUID previously inserted by another tenant.
    const uuids = items.map((item) => item.uuid);
    const result: Array<{ uuid: string }> = await this.dataSource.query(
      `SELECT uuid::text
         FROM history
        WHERE mitra_id = $1::uuid AND uuid = ANY($2::uuid[])`,
      [mitraId, uuids],
    );
    return { acknowledgedUuids: result.map((row) => row.uuid) };
  }

  private resultRows<T>(result: unknown): T[] {
    if (!Array.isArray(result)) return [];
    if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as T[];
    return result as T[];
  }
}
