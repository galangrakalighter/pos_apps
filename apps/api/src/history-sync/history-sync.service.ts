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
      const offset = index * 13;
      values.push(
        item.uuid,
        mitraId,
        item.productId,
        item.soldQuantity,
        item.price,
        item.createdAt,
        item.note ?? null,
        item.transactionUuid ?? item.uuid,
        item.paymentMethod ?? 'tunai',
        item.amountPaid ?? (Number(item.price) * item.soldQuantity).toFixed(2),
        item.changeAmount ?? '0.00',
        item.transactionTotal ?? (Number(item.price) * item.soldQuantity).toFixed(2),
        JSON.stringify(item.rawMaterialAddons ?? []),
      );
      return `($${offset + 1}::uuid, $${offset + 2}::uuid, $${offset + 3}::bigint,
        $${offset + 4}::integer, $${offset + 5}::numeric, $${offset + 6}::timestamptz,
        $${offset + 7}::text, $${offset + 8}::uuid, $${offset + 9}::varchar,
        $${offset + 10}::numeric, $${offset + 11}::numeric, $${offset + 12}::numeric,
        $${offset + 13}::jsonb)`;
    });

    await this.dataSource.transaction(async (manager) => {
      const productIds = [...new Set(items.map((item) => String(item.productId)))];
      const sellable: Array<{ id: string }> = await manager.query(
        `SELECT id::text FROM produk_mitra
          WHERE mitra_id = $1::uuid AND jenis_produk = 'produk_jadi' AND harga > 0
            AND id = ANY($2::bigint[])`, [mitraId, productIds],
      );
      if (sellable.length !== productIds.length) {
        throw new ConflictException('Hanya produk jadi milik Mitra yang dapat dijual melalui POS');
      }
      const rawInserted: unknown = await manager.query(
        `INSERT INTO history
          (uuid, mitra_id, id_produk, terjual, harga, created_at, keterangan,
           transaction_uuid, payment_method, amount_paid, change_amount, transaction_total,
           raw_material_addons)
         VALUES ${rows.join(',')}
         ON CONFLICT (uuid) DO NOTHING
         RETURNING uuid::text, id_produk::text AS product_id, terjual`,
        values,
      );
      const inserted = this.resultRows<{ uuid: string; product_id: string; terjual: number }>(rawInserted);
      const soldByProduct = new Map<string, number>();
      for (const row of inserted) soldByProduct.set(row.product_id, (soldByProduct.get(row.product_id) ?? 0) + row.terjual);
      for (const [productId, quantity] of soldByProduct) {
        const changed: unknown = await manager.query(
          `UPDATE produk_mitra SET stock = stock - $1, updated_at = now()
            WHERE id = $2::bigint AND mitra_id = $3::uuid AND jenis_produk = 'produk_jadi' AND stock >= $1
            RETURNING id::text`, [quantity, productId, mitraId],
        );
        if (this.resultRows<{ id: string }>(changed).length !== 1) throw new ConflictException(`Stok produk jadi ${productId} tidak mencukupi`);
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
