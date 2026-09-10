import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminSalesQueryDto } from './dto/admin-sales-query.dto';

@Injectable()
export class AdminSalesService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(adminId: string, query: AdminSalesQueryDto) {
    await this.assertCentralAdmin(adminId);
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => { params.push(value); return `$${params.length}`; };
    if (query.mitraId) where.push(`h.mitra_id = ${add(query.mitraId)}::uuid`);
    if (query.from) where.push(`h.created_at >= ${add(query.from)}::timestamptz`);
    if (query.to) where.push(`h.created_at < (${add(query.to)}::timestamptz + interval '1 day')`);
    if (query.productId) where.push(`h.id_produk = ${add(query.productId)}::bigint`);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const byPartner = await this.dataSource.query(
      `WITH tx AS (
         SELECT h.mitra_id, h.transaction_uuid, SUM(h.terjual)::integer AS items_sold,
                GREATEST(0, SUM(h.terjual * h.harga) - MAX(h.discount_amount)) AS revenue
           FROM history h ${clause}
          GROUP BY h.mitra_id, h.transaction_uuid
       )
       SELECT tx.mitra_id AS "mitraId", u.nama_mitra AS "partnerName",
              COUNT(*)::integer AS "transactionCount", COALESCE(SUM(tx.items_sold),0)::integer AS "itemsSold",
              COALESCE(SUM(tx.revenue),0)::text AS revenue
         FROM tx JOIN users u ON u.id=tx.mitra_id
        GROUP BY tx.mitra_id,u.nama_mitra ORDER BY SUM(tx.revenue) DESC`,
      params,
    );
    const topProducts = await this.dataSource.query(
      `SELECT h.id_produk::text AS "productId", p.nama_produk AS "productName",
              SUM(h.terjual)::integer AS "itemsSold",
              SUM(h.terjual * h.harga)::text AS revenue
         FROM history h
         JOIN produk_mitra p ON p.id = h.id_produk AND p.mitra_id = h.mitra_id
         ${clause}
        GROUP BY h.id_produk, p.nama_produk
        ORDER BY SUM(h.terjual) DESC
        LIMIT 10`,
      params,
    );
    const procurementParams: unknown[] = [adminId];
    const procurementWhere = [`pemberi_id = $1::uuid`, `status IN ('dikirim', 'selesai')`];
    if (query.mitraId) { procurementParams.push(query.mitraId); procurementWhere.push(`pemesan_id = $${procurementParams.length}::uuid`); }
    if (query.from) { procurementParams.push(query.from); procurementWhere.push(`created_at >= $${procurementParams.length}::timestamptz`); }
    if (query.to) { procurementParams.push(query.to); procurementWhere.push(`created_at < ($${procurementParams.length}::timestamptz + interval '1 day')`); }
    const centralRevenueRows: Array<{ revenue: string; orderCount: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(total_amount), 0)::text AS revenue,
              COUNT(*)::integer AS "orderCount"
         FROM orders WHERE ${procurementWhere.join(' AND ')}`,
      procurementParams,
    );
    const distributionParams: unknown[] = [adminId];
    const distributionWhere = [`d.pusat_id = $1::uuid`];
    if (query.mitraId) { distributionParams.push(query.mitraId); distributionWhere.push(`d.mitra_id = $${distributionParams.length}::uuid`); }
    if (query.from) { distributionParams.push(query.from); distributionWhere.push(`d.created_at >= $${distributionParams.length}::timestamptz`); }
    if (query.to) { distributionParams.push(query.to); distributionWhere.push(`d.created_at < ($${distributionParams.length}::timestamptz + interval '1 day')`); }
    const distributionRevenue: Array<{ revenue: string; distributionCount: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(d.total_amount), 0)::text AS revenue,
              COUNT(*)::integer AS "distributionCount"
         FROM partner_stock_distributions d WHERE ${distributionWhere.join(' AND ')}`,
      distributionParams,
    );
    const centralByPartner = await this.dataSource.query(
      `WITH revenues AS (
         SELECT o.pemesan_id AS mitra_id, SUM(o.total_amount) AS revenue,
                COUNT(*)::integer AS order_count, 0::integer AS distribution_count
           FROM orders o
          WHERE o.pemberi_id = $1::uuid AND o.status IN ('dikirim', 'selesai')
            AND ($2::uuid IS NULL OR o.pemesan_id = $2::uuid)
            AND ($3::timestamptz IS NULL OR o.created_at >= $3::timestamptz)
            AND ($4::timestamptz IS NULL OR o.created_at < $4::timestamptz + interval '1 day')
          GROUP BY o.pemesan_id
         UNION ALL
         SELECT d.mitra_id, SUM(d.total_amount), 0, COUNT(*)::integer
           FROM partner_stock_distributions d
          WHERE d.pusat_id = $1::uuid
            AND ($2::uuid IS NULL OR d.mitra_id = $2::uuid)
            AND ($3::timestamptz IS NULL OR d.created_at >= $3::timestamptz)
            AND ($4::timestamptz IS NULL OR d.created_at < $4::timestamptz + interval '1 day')
          GROUP BY d.mitra_id
       )
       SELECT r.mitra_id::text AS "mitraId", u.nama_mitra AS "partnerName",
              SUM(r.revenue)::text AS revenue, SUM(r.order_count)::integer AS "orderCount",
              SUM(r.distribution_count)::integer AS "distributionCount"
         FROM revenues r JOIN users u ON u.id = r.mitra_id
        GROUP BY r.mitra_id, u.nama_mitra ORDER BY SUM(r.revenue) DESC`,
      [adminId, query.mitraId ?? null, query.from ?? null, query.to ?? null],
    );
    const procurement = centralRevenueRows[0]; const initial = distributionRevenue[0];
    return { filters: query, byPartner, topProducts, centralRevenue: {
      totalRevenue: (Number(procurement.revenue) + Number(initial.revenue)).toFixed(2),
      procurementRevenue: procurement.revenue, initialStockRevenue: initial.revenue,
      orderCount: procurement.orderCount, distributionCount: initial.distributionCount,
      byPartner: centralByPartner,
    } };
  }

  private async assertCentralAdmin(userId: string) {
    const rows: Array<{ isPusat: boolean }> = await this.dataSource.query(
      `SELECT "isPusat" AS "isPusat" FROM users WHERE id = $1::uuid`, [userId],
    );
    if (!rows[0]?.isPusat) throw new ForbiddenException('Central admin access required');
  }
}
