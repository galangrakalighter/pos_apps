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
        const rawUpdated: unknown = await manager.query(
          `UPDATE produk_mitra
              SET stock = stock - $1, updated_at = now()
            WHERE id = $2::bigint AND mitra_id = $3::uuid AND stock >= $1
            RETURNING id::text`,
          [quantity, productId, mitraId],
        );
        if (this.resultRows<{ id: string }>(rawUpdated).length !== 1) {
          throw new ConflictException(`Stok produk ${productId} tidak mencukupi untuk sinkronisasi penjualan`);
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
