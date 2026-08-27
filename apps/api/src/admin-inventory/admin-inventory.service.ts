import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateWarehouseProductDto } from './dto/create-warehouse-product.dto';
import { UpdateWarehouseProductDto } from './dto/update-warehouse-product.dto';

@Injectable()
export class AdminInventoryService {
  constructor(private readonly dataSource: DataSource) {}

  async partners(admin: AuthenticatedUser) {
    this.assertAdmin(admin);
    return this.dataSource.query(
      `SELECT u.id::text, u.username, u.nama_mitra AS "partnerName", u.wilayah AS region,
              u.is_locked AS "isLocked",
              (EXISTS (SELECT 1 FROM history hx WHERE hx.mitra_id = u.id) OR
               EXISTS (SELECT 1 FROM orders ox WHERE ox.pemesan_id = u.id OR ox.pemberi_id = u.id) OR
               EXISTS (SELECT 1 FROM partner_stock_distributions dx WHERE dx.mitra_id = u.id OR dx.pusat_id = u.id)) AS "hasActivity",
              COALESCE(p."productCount", 0) AS "productCount",
              COALESCE(p."totalStock", 0) AS "totalStock",
              p."stockUpdatedAt", h."lastSalesSyncAt"
         FROM users u
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::integer AS "productCount", COALESCE(SUM(stock), 0)::integer AS "totalStock",
                  MAX(updated_at) AS "stockUpdatedAt"
             FROM produk_mitra WHERE mitra_id = u.id
         ) p ON TRUE
         LEFT JOIN LATERAL (
           SELECT MAX(synced_at) AS "lastSalesSyncAt" FROM history WHERE mitra_id = u.id
         ) h ON TRUE
        WHERE u."isPusat" = FALSE
        ORDER BY u.nama_mitra, u.username`,
    );
  }

  async partnerStock(admin: AuthenticatedUser, mitraId: string) {
    this.assertAdmin(admin);
    const users: Array<{ id: string; username: string; partnerName: string; region: string | null }> =
      await this.dataSource.query(
        `SELECT id::text, username, nama_mitra AS "partnerName", wilayah AS region
           FROM users WHERE id = $1::uuid AND "isPusat" = FALSE`, [mitraId],
      );
    if (!users[0]) throw new NotFoundException('Mitra tidak ditemukan');
    const products = await this.dataSource.query(
      `SELECT id::text, nama_produk AS name, stock, harga::text AS price,
              updated_at AS "updatedAt"
         FROM produk_mitra
        WHERE mitra_id = $1::uuid
        ORDER BY nama_produk, id`, [mitraId],
    );
    return { partner: users[0], products, snapshotAt: new Date().toISOString() };
  }

  async myProducts(user: AuthenticatedUser) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus akun Mitra');
    return this.dataSource.query(
      `SELECT DISTINCT ON (p.id)
              p.id::text, p.nama_produk AS name, p.stock, p.harga::text AS price,
              COALESCE(w.tipe, 'Produk') AS category, w.image_url AS "imageUrl",
              p.updated_at AS "updatedAt"
         FROM produk_mitra p
         LEFT JOIN partner_stock_distribution_items di ON di.partner_product_id = p.id
         LEFT JOIN warehouse w ON w.id = di.warehouse_id
        WHERE p.mitra_id = $1::uuid
        ORDER BY p.id, di.id DESC NULLS LAST`,
      [user.id],
    );
  }

  async updateMyProductPrice(user: AuthenticatedUser, productId: string, price: string) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus akun Mitra');
    const rows = await this.dataSource.query(
      `UPDATE produk_mitra SET harga = $1::numeric, updated_at = now()
        WHERE id = $2::bigint AND mitra_id = $3::uuid
        RETURNING id::text, harga::text AS price, updated_at AS "updatedAt"`,
      [price, productId, user.id],
    );
    if (!rows[0]) throw new NotFoundException('Produk Mitra tidak ditemukan');
    return rows[0];
  }

  async warehouseCatalog() {
    return this.dataSource.query(
      `SELECT id::text, nama_bumbu AS name, stock, tipe AS type, harga::text AS price, image_url AS "imageUrl"
         FROM warehouse ORDER BY nama_bumbu, id`,
    );
  }

  async adminWarehouseCatalog(admin: AuthenticatedUser) {
    this.assertAdmin(admin);
    return this.warehouseCatalog();
  }

  async createWarehouseProduct(admin: AuthenticatedUser, dto: CreateWarehouseProductDto) {
    this.assertAdmin(admin);
    const existing = await this.dataSource.query(
      `SELECT id FROM warehouse WHERE lower(nama_bumbu) = lower($1) LIMIT 1`, [dto.name.trim()],
    );
    if (existing.length) throw new ConflictException('Nama produk gudang sudah digunakan');
    const rows = await this.dataSource.query(
      `INSERT INTO warehouse (nama_bumbu, stock, tipe, harga)
       VALUES ($1, $2, $3, $4::numeric)
       RETURNING id::text, nama_bumbu AS name, stock, tipe AS type, harga::text AS price, image_url AS "imageUrl"`,
      [dto.name.trim(), dto.stock ?? 0, dto.type.trim(), dto.price],
    );
    return rows[0];
  }

  async updateWarehouseProduct(admin: AuthenticatedUser, id: string, dto: UpdateWarehouseProductDto) {
    this.assertAdmin(admin);
    const current: Array<{ name: string; usedInOrder: boolean }> = await this.dataSource.query(
      `SELECT w.nama_bumbu AS name,
              EXISTS (SELECT 1 FROM order_items oi WHERE oi.warehouse_id = w.id) AS "usedInOrder"
         FROM warehouse w WHERE w.id = $1::bigint`, [id],
    );
    if (!current[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
    if (current[0].usedInOrder && current[0].name !== dto.name.trim()) {
      throw new ConflictException('Nama produk yang sudah memiliki riwayat order tidak dapat diubah; stok, tipe, dan harga tetap dapat diedit');
    }
    const duplicate = await this.dataSource.query(
      `SELECT id FROM warehouse WHERE lower(nama_bumbu) = lower($1) AND id <> $2::bigint LIMIT 1`,
      [dto.name.trim(), id],
    );
    if (duplicate.length) throw new ConflictException('Nama produk gudang sudah digunakan');
    const rows = await this.dataSource.query(
      `UPDATE warehouse SET nama_bumbu = $1, tipe = $2, stock = $3, harga = $4::numeric, updated_at = now()
        WHERE id = $5::bigint
        RETURNING id::text, nama_bumbu AS name, stock, tipe AS type, harga::text AS price, image_url AS "imageUrl"`,
      [dto.name.trim(), dto.type.trim(), dto.stock, dto.price, id],
    );
    if (!rows[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
    return rows[0];
  }

  async deleteWarehouseProduct(admin: AuthenticatedUser, id: string) {
    this.assertAdmin(admin);
    try {
      const rows = await this.dataSource.query(
        `DELETE FROM warehouse WHERE id = $1::bigint RETURNING id::text`, [id],
      );
      if (!rows[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
      return { deleted: true, id: rows[0].id };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23503') {
        throw new ConflictException('Produk sudah memiliki riwayat order/distribusi dan tidak dapat dihapus');
      }
      throw error;
    }
  }

  async saveWarehouseImage(admin: AuthenticatedUser, id: string, file?: { buffer: Buffer; mimetype: string; originalname: string }) {
    this.assertAdmin(admin);
    if (!file) throw new BadRequestException('Gambar produk wajib dipilih');
    const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Format gambar harus JPG, PNG, atau WEBP');
    const directory = join(process.cwd(), 'uploads', 'products');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer);
    const imageUrl = `/api/v1/warehouse/images/${filename}`;
    const rows = await this.dataSource.query(
      `UPDATE warehouse SET image_url = $1, updated_at = now() WHERE id = $2::bigint
       RETURNING id::text, nama_bumbu AS name, stock, tipe AS type, harga::text AS price, image_url AS "imageUrl"`,
      [imageUrl, id],
    );
    if (!rows[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
    return rows[0];
  }

  async productImage(filename: string) {
    if (!/^[0-9a-f-]+\.(jpg|png|webp)$/.test(filename)) throw new NotFoundException('Gambar tidak ditemukan');
    try {
      const data = await readFile(join(process.cwd(), 'uploads', 'products', filename));
      const type = extname(filename) === '.png' ? 'image/png' : extname(filename) === '.webp' ? 'image/webp' : 'image/jpeg';
      return new StreamableFile(data, { type, disposition: `inline; filename="${filename}"` });
    } catch { throw new NotFoundException('Gambar tidak ditemukan'); }
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!user.isPusat) throw new ForbiddenException('Central admin access required');
  }
}
