import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateWarehouseProductDto } from './dto/create-warehouse-product.dto';
import { UpdateWarehouseProductDto } from './dto/update-warehouse-product.dto';
import { CreateFinishedProductDto } from './dto/create-finished-product.dto';
import { UpdateFinishedProductDto } from './dto/update-finished-product.dto';
import { UpdateOwnFinishedProductDto } from './dto/update-own-finished-product.dto';
import { StockAdjustmentItemDto } from './dto/sync-stock-adjustments.dto';

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
           SELECT COUNT(*)::integer AS "productCount", COALESCE(SUM(stock), 0)::float8 AS "totalStock",
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
      `SELECT p.id::text, p.nama_produk AS name,
              p.stock::float8 AS stock,
              p.harga::text AS price, p.jenis_produk AS kind, COALESCE(p.kategori, 'Tanpa kategori') AS category,
              p.image_url AS "imageUrl", p.master_produk_id::text AS "masterId", master.satuan AS unit,
              p.updated_at AS "updatedAt"
         FROM produk_mitra p
         LEFT JOIN warehouse master ON master.id = p.master_produk_id
         LEFT JOIN LATERAL (
           SELECT FLOOR(MIN(COALESCE(raw.stock, 0) / convert_inventory_unit(r.quantity_required, r.satuan, ingredient.satuan)))::integer AS capacity
             FROM product_recipes r
             JOIN warehouse ingredient ON ingredient.id = r.ingredient_id
             LEFT JOIN produk_mitra raw ON raw.mitra_id = p.mitra_id
               AND raw.master_produk_id = r.ingredient_id AND raw.jenis_produk = 'bahan_baku'
            WHERE r.finished_product_id = p.master_produk_id
         ) cap ON p.jenis_produk = 'produk_jadi'
        WHERE p.mitra_id = $1::uuid
        ORDER BY p.nama_produk, p.id`, [mitraId],
    );
    return { partner: users[0], products, snapshotAt: new Date().toISOString() };
  }

  async myProducts(user: AuthenticatedUser) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus akun Mitra');
    return this.dataSource.query(
      `SELECT p.id::text, p.nama_produk AS name,
              p.stock::float8 AS stock,
              p.harga::text AS price,
              p.jenis_produk AS kind,
              COALESCE(p.kategori, master.tipe, CASE WHEN p.jenis_produk = 'produk_jadi' THEN 'Produk jadi' ELSE 'Bahan baku' END) AS category,
              COALESCE(p.image_url, master.image_url) AS "imageUrl", master.satuan AS unit,
              TRUE AS "recipeComplete",
              '[]'::json AS recipes,
              p.updated_at AS "updatedAt"
         FROM produk_mitra p
         LEFT JOIN warehouse master ON master.id = p.master_produk_id
        WHERE p.mitra_id = $1::uuid
        ORDER BY p.nama_produk, p.id`,
      [user.id],
    );
  }

  async updateMyProductPrice(user: AuthenticatedUser, productId: string, price: string) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus akun Mitra');
    const rows = await this.dataSource.query(
      `UPDATE produk_mitra SET harga = $1::numeric, updated_at = now()
        WHERE id = $2::bigint AND mitra_id = $3::uuid AND jenis_produk = 'produk_jadi'
        RETURNING id::text, harga::text AS price, updated_at AS "updatedAt"`,
      [price, productId, user.id],
    );
    if (!rows[0]) throw new NotFoundException('Produk Mitra tidak ditemukan');
    return rows[0];
  }

  async updateMyFinishedProduct(user: AuthenticatedUser, productId: string, dto: UpdateOwnFinishedProductDto) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus akun Mitra');
    const rows = await this.dataSource.query(
      `UPDATE produk_mitra
          SET stock = $1,
              harga = COALESCE($2::numeric, harga),
              updated_at = now()
        WHERE id = $3::bigint AND mitra_id = $4::uuid AND jenis_produk = 'produk_jadi'
        RETURNING id::text, stock::float8 AS stock, harga::text AS price, updated_at AS "updatedAt"`,
      [dto.stock, dto.price ?? null, productId, user.id],
    );
    if (!rows[0]) throw new NotFoundException('Produk jadi Mitra tidak ditemukan');
    return rows[0];
  }

  async syncStockAdjustments(user: AuthenticatedUser, items: StockAdjustmentItemDto[]) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus akun Mitra');
    if (!items.length) return { acknowledgedUuids: [] };
    if (new Set(items.map((item) => item.uuid)).size !== items.length) throw new BadRequestException('UUID penyesuaian stok tidak boleh duplikat');
    await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      for (const item of [...items].sort((a, b) => Number(a.productId) - Number(b.productId))) {
        const duplicate: Array<{ uuid: string }> = await manager.query(
          `SELECT uuid::text FROM partner_stock_adjustments WHERE uuid = $1::uuid AND mitra_id = $2::uuid`, [item.uuid, user.id],
        );
        if (duplicate[0]) continue;
        const products: Array<{ id: string; kind: 'bahan_baku' | 'produk_jadi'; stock: number }> = await manager.query(
          `SELECT id::text, jenis_produk AS kind, stock::float8 AS stock FROM produk_mitra
            WHERE id = $1::bigint AND mitra_id = $2::uuid FOR UPDATE`, [item.productId, user.id],
        );
        const product = products[0];
        if (!product) throw new NotFoundException('Produk Mitra tidak ditemukan');
        if (product.stock + item.delta < -0.000001) throw new ConflictException('Stok tidak mencukupi untuk dikurangi');
        const inserted = await manager.query(
          `INSERT INTO partner_stock_adjustments (uuid, mitra_id, product_id, delta, created_at)
           VALUES ($1::uuid, $2::uuid, $3::bigint, $4::numeric, $5::timestamptz)
           ON CONFLICT (uuid) DO NOTHING RETURNING uuid::text`,
          [item.uuid, user.id, item.productId, item.delta, item.createdAt],
        );
        if (this.resultRows<{ uuid: string }>(inserted).length) await manager.query(
          `UPDATE produk_mitra SET stock = GREATEST(0, stock + $1::numeric), updated_at = now()
            WHERE id = $2::bigint AND mitra_id = $3::uuid`, [item.delta, item.productId, user.id],
        );
      }
    });
    const acknowledged: Array<{ uuid: string }> = await this.dataSource.query(
      `SELECT uuid::text FROM partner_stock_adjustments WHERE mitra_id = $1::uuid AND uuid = ANY($2::uuid[])`,
      [user.id, items.map((item) => item.uuid)],
    );
    return { acknowledgedUuids: acknowledged.map((item) => item.uuid) };
  }

  async createFinishedProduct(admin: AuthenticatedUser, mitraId: string, dto: CreateFinishedProductDto) {
    this.assertAdmin(admin);
    await this.assertPartnerExists(mitraId);
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const masters: Array<{ id: string; name: string; category: string; imageUrl: string | null }> = await manager.query(
        `SELECT id::text, nama_bumbu AS name, tipe AS category, image_url AS "imageUrl"
           FROM warehouse WHERE id = $1::bigint AND jenis_produk = 'produk_jadi' AND deleted_at IS NULL FOR UPDATE`, [dto.warehouseId],
      );
      const master = masters[0];
      if (!master) throw new NotFoundException('Master produk jadi tidak ditemukan');
      const existing: Array<{ id: string }> = await manager.query(
        `SELECT id::text FROM produk_mitra WHERE mitra_id = $1::uuid AND master_produk_id = $2::bigint FOR UPDATE`, [mitraId, master.id],
      );
      if (existing[0]) throw new ConflictException('Produk jadi tersebut sudah dimiliki Mitra');
      const rows = await manager.query(
        `INSERT INTO produk_mitra
          (mitra_id, master_produk_id, nama_produk, jenis_produk, kategori, image_url, stock, harga)
         VALUES ($1::uuid, $2::bigint, $3, 'produk_jadi', $4, $5, 0, 0)
         RETURNING id::text, nama_produk AS name, jenis_produk AS kind,
                   COALESCE(kategori, 'Produk jadi') AS category, stock::float8 AS stock,
                   harga::text AS price, image_url AS "imageUrl", updated_at AS "updatedAt"`,
        [mitraId, master.id, master.name, master.category, master.imageUrl],
      );
      return rows[0];
    });
  }

  async updateFinishedProduct(admin: AuthenticatedUser, mitraId: string, productId: string, dto: UpdateFinishedProductDto) {
    this.assertAdmin(admin);
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const products: Array<{ id: string; stock: number; masterId: string }> = await manager.query(
        `SELECT id::text, stock, master_produk_id::text AS "masterId" FROM produk_mitra
          WHERE id = $1::bigint AND mitra_id = $2::uuid AND jenis_produk = 'produk_jadi' FOR UPDATE`, [productId, mitraId],
      );
      const product = products[0]; if (!product?.masterId) throw new NotFoundException('Produk jadi Mitra tidak ditemukan');
      const delta = dto.stock - product.stock;
      if (delta > 0) {
        const changed = await manager.query(`UPDATE warehouse SET stock = stock - $1, updated_at = now() WHERE id = $2::bigint AND stock >= $1 RETURNING id`, [delta, product.masterId]);
        if (!this.resultRows<{ id: string }>(changed).length) throw new ConflictException('Stok produk jadi di pusat tidak mencukupi');
      } else if (delta < 0) await manager.query(`UPDATE warehouse SET stock = stock + $1, updated_at = now() WHERE id = $2::bigint`, [-delta, product.masterId]);
      const rows = await manager.query(
        `UPDATE produk_mitra SET stock = $1, updated_at = now() WHERE id = $2::bigint
         RETURNING id::text, nama_produk AS name, jenis_produk AS kind, COALESCE(kategori, 'Produk jadi') AS category, stock::float8 AS stock, harga::text AS price, image_url AS "imageUrl", updated_at AS "updatedAt"`, [dto.stock, productId],
      );
      return rows[0];
    });
  }

  async deleteFinishedProduct(admin: AuthenticatedUser, mitraId: string, productId: string) {
    this.assertAdmin(admin);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const rows = await manager.query(
          `DELETE FROM produk_mitra
            WHERE id = $1::bigint AND mitra_id = $2::uuid AND jenis_produk = 'produk_jadi'
            RETURNING id::text, stock, master_produk_id::text AS "masterId"`, [productId, mitraId],
        );
        if (!rows[0]) throw new NotFoundException('Produk jadi Mitra tidak ditemukan');
        return { deleted: true, id: rows[0].id };
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23503') {
        throw new ConflictException('Produk jadi sudah memiliki riwayat penjualan dan tidak dapat dihapus');
      }
      throw error;
    }
  }

  async warehouseCatalog() {
    return this.dataSource.query(
      `SELECT id::text, nama_bumbu AS name, stock::float8 AS stock, tipe AS type, harga::text AS price,
              jenis_produk AS kind, satuan AS unit, image_url AS "imageUrl", is_available AS "isAvailable"
         FROM warehouse WHERE jenis_produk = 'bahan_baku' AND deleted_at IS NULL ORDER BY nama_bumbu, id`,
    );
  }

  async adminWarehouseCatalog(admin: AuthenticatedUser) {
    this.assertAdmin(admin);
    return this.dataSource.query(
      `SELECT w.id::text, w.nama_bumbu AS name, w.stock::float8 AS stock, w.tipe AS type, w.harga::text AS price,
              w.jenis_produk AS kind, w.satuan AS unit, w.image_url AS "imageUrl", w.is_available AS "isAvailable",
              COALESCE((SELECT json_agg(json_build_object('ingredientId', r.ingredient_id::text, 'quantity', r.quantity_required::float8, 'name', i.nama_bumbu, 'unit', r.satuan) ORDER BY i.nama_bumbu)
                FROM product_recipes r JOIN warehouse i ON i.id = r.ingredient_id WHERE r.finished_product_id = w.id), '[]'::json) AS recipes
         FROM warehouse w WHERE w.deleted_at IS NULL ORDER BY w.jenis_produk, w.nama_bumbu, w.id`,
    );
  }

  async createWarehouseProduct(admin: AuthenticatedUser, dto: CreateWarehouseProductDto) {
    this.assertAdmin(admin);
    this.validateRawMaterialClassification(dto.kind, dto.type, dto.unit);
    const existing = await this.dataSource.query(
      `SELECT id FROM warehouse WHERE lower(nama_bumbu) = lower($1) AND jenis_produk = $2 AND deleted_at IS NULL LIMIT 1`, [dto.name.trim(), dto.kind],
    );
    if (existing.length) throw new ConflictException('Nama produk gudang sudah digunakan');
    const rows = await this.dataSource.query(
      `INSERT INTO warehouse (nama_bumbu, stock, tipe, harga, jenis_produk, satuan, is_available)
       VALUES ($1, 0, $2, $3::numeric, $4, $5, $6)
       RETURNING id::text, nama_bumbu AS name, stock::float8 AS stock, tipe AS type, harga::text AS price, jenis_produk AS kind, satuan AS unit, image_url AS "imageUrl", is_available AS "isAvailable"`,
      [dto.name.trim(), dto.type.trim(), dto.price, dto.kind, dto.kind === 'bahan_baku' ? dto.unit : 'pcs', dto.isAvailable],
    );
    await this.replaceRecipes(rows[0].id, dto.kind, dto.recipes);
    rows[0].recipes = dto.recipes;
    return rows[0];
  }

  async updateWarehouseProduct(admin: AuthenticatedUser, id: string, dto: UpdateWarehouseProductDto) {
    this.assertAdmin(admin);
    this.validateRawMaterialClassification(dto.kind, dto.type, dto.unit);
    const current: Array<{ name: string; kind: string; usedInOrder: boolean; usedByPartner: boolean }> = await this.dataSource.query(
      `SELECT w.nama_bumbu AS name,
              w.jenis_produk AS kind,
              EXISTS (SELECT 1 FROM produk_mitra p WHERE p.master_produk_id = w.id) AS "usedByPartner",
              EXISTS (SELECT 1 FROM order_items oi WHERE oi.warehouse_id = w.id) AS "usedInOrder"
         FROM warehouse w WHERE w.id = $1::bigint AND w.deleted_at IS NULL`, [id],
    );
    if (!current[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
    if ((current[0].usedInOrder || current[0].usedByPartner) && current[0].kind !== dto.kind) {
      throw new ConflictException('Jenis produk yang sudah digunakan tidak dapat diubah');
    }
    if (current[0].usedInOrder && current[0].name !== dto.name.trim()) {
      throw new ConflictException('Nama produk yang sudah memiliki riwayat order tidak dapat diubah; stok, tipe, dan harga tetap dapat diedit');
    }
    const duplicate = await this.dataSource.query(
      `SELECT id FROM warehouse WHERE lower(nama_bumbu) = lower($1) AND jenis_produk = $2 AND id <> $3::bigint AND deleted_at IS NULL LIMIT 1`,
      [dto.name.trim(), dto.kind, id],
    );
    if (duplicate.length) throw new ConflictException('Nama produk gudang sudah digunakan');
    const rows = await this.dataSource.query(
      `UPDATE warehouse SET nama_bumbu = $1, tipe = $2, stock = 0, harga = $3::numeric, jenis_produk = $4, satuan = $5, is_available = $6, updated_at = now()
        WHERE id = $7::bigint
        RETURNING id::text, nama_bumbu AS name, stock::float8 AS stock, tipe AS type, harga::text AS price, jenis_produk AS kind, satuan AS unit, image_url AS "imageUrl", is_available AS "isAvailable"`,
      [dto.name.trim(), dto.type.trim(), dto.price, dto.kind, dto.kind === 'bahan_baku' ? dto.unit : 'pcs', dto.isAvailable, id],
    );
    if (!rows[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
    await this.replaceRecipes(id, dto.kind, dto.recipes);
    rows[0].recipes = dto.recipes;
    if (dto.kind === 'produk_jadi') {
      await this.dataSource.query(
        `UPDATE produk_mitra SET nama_produk = $1, kategori = $2, updated_at = now()
          WHERE master_produk_id = $3::bigint AND jenis_produk = 'produk_jadi'`,
        [dto.name.trim(), dto.type.trim(), id],
      );
    }
    return rows[0];
  }

  async deleteWarehouseProduct(admin: AuthenticatedUser, id: string) {
    this.assertAdmin(admin);
    return this.dataSource.transaction(async (manager) => {
      const rows: Array<{ id: string; kind: string }> = await manager.query(
        `UPDATE warehouse SET deleted_at = now(), updated_at = now()
          WHERE id = $1::bigint AND deleted_at IS NULL
          RETURNING id::text, jenis_produk AS kind`, [id],
      );
      if (!rows[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
      // Riwayat order dan distribusi tetap utuh. Hanya pemakaian bahan pada
      // resep aktif yang dilepas karena bahan tersebut tak lagi tersedia.
      if (rows[0].kind === 'bahan_baku') {
        await manager.query(`DELETE FROM product_recipes WHERE ingredient_id = $1::bigint`, [id]);
      }
      return { deleted: true, id: rows[0].id };
    });
  }

  async saveWarehouseImage(admin: AuthenticatedUser, id: string, file?: { buffer: Buffer; mimetype: string; originalname: string }) {
    this.assertAdmin(admin);
    if (!file) throw new BadRequestException('Gambar produk wajib dipilih');
    if (!file.buffer?.length) throw new BadRequestException('Isi file gambar kosong atau tidak dapat dibaca');
    const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    const originalExtension = extname(file.originalname || '').toLowerCase();
    const extension = extensions[file.mimetype] ?? (['.jpg', '.jpeg', '.png', '.webp'].includes(originalExtension) ? (originalExtension === '.jpeg' ? '.jpg' : originalExtension) : undefined);
    if (!extension) throw new BadRequestException('Format gambar harus JPG, PNG, atau WEBP');
    const directory = join(process.cwd(), 'uploads', 'products');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer);
    const imageUrl = `/api/v1/warehouse/images/${filename}`;
    const rows = await this.dataSource.query(
      `UPDATE warehouse SET image_url = $1, updated_at = now() WHERE id = $2::bigint
       RETURNING id::text, nama_bumbu AS name, stock::float8 AS stock, tipe AS type, harga::text AS price, jenis_produk AS kind, image_url AS "imageUrl"`,
      [imageUrl, id],
    );
    if (!rows[0]) throw new NotFoundException('Produk gudang tidak ditemukan');
    await this.dataSource.query(
      `UPDATE produk_mitra SET image_url = $1, updated_at = now()
        WHERE master_produk_id = $2::bigint AND jenis_produk = 'produk_jadi'`,
      [imageUrl, id],
    );
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

  private validateRawMaterialClassification(kind: 'bahan_baku' | 'produk_jadi', type: string, unit: string) {
    if (kind !== 'bahan_baku') return;
    if (!['Bahan Baku Saus', 'Tepung', 'Bumbu Tabur'].includes(type)) throw new BadRequestException('Kategori bahan baku tidak valid');
    if (!['kilogram', 'liter'].includes(unit)) throw new BadRequestException('Bahan baku hanya menggunakan satuan kilogram atau liter');
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (!user.isPusat) throw new ForbiddenException('Central admin access required');
  }

  private async assertPartnerExists(mitraId: string) {
    const rows = await this.dataSource.query(`SELECT id FROM users WHERE id = $1::uuid AND "isPusat" = FALSE`, [mitraId]);
    if (!rows[0]) throw new NotFoundException('Mitra tidak ditemukan');
  }

  private resultRows<T>(result: unknown): T[] {
    if (!Array.isArray(result)) return [];
    if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as T[];
    return result as T[];
  }

  private async replaceRecipes(productId: string, kind: 'bahan_baku' | 'produk_jadi', recipes: Array<{ ingredientId: string; quantity: number; unit: string }>) {
    if (kind === 'produk_jadi' && recipes.length) {
      const ids = [...new Set(recipes.map((item) => item.ingredientId))];
      if (ids.length !== recipes.length) throw new BadRequestException('Bahan baku pada resep tidak boleh duplikat');
      const ingredients: Array<{ id: string; unit: string }> = await this.dataSource.query(`SELECT id::text, satuan AS unit FROM warehouse WHERE id = ANY($1::bigint[]) AND jenis_produk = 'bahan_baku' AND deleted_at IS NULL`, [ids]);
      if (ingredients.length !== ids.length) throw new BadRequestException('Resep hanya boleh menggunakan bahan baku dari Gudang Pusat');
      const unitById = new Map(ingredients.map((item) => [item.id, item.unit]));
      for (const recipe of recipes) if (!this.compatibleUnits(recipe.unit, unitById.get(recipe.ingredientId)!)) throw new BadRequestException('Satuan resep tidak sesuai dengan jenis satuan bahan baku');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM product_recipes WHERE finished_product_id = $1::bigint`, [productId]);
      if (kind === 'produk_jadi') for (const recipe of recipes) await manager.query(
        `INSERT INTO product_recipes (finished_product_id, ingredient_id, quantity_required, satuan) VALUES ($1::bigint, $2::bigint, $3::numeric, $4)`,
        [productId, recipe.ingredientId, recipe.quantity, recipe.unit],
      );
    });
  }

  private compatibleUnits(first: string, second: string) {
    const mass = ['gram', 'kilogram']; const volume = ['mililiter', 'liter'];
    return first === second || (mass.includes(first) && mass.includes(second)) || (volume.includes(first) && volume.includes(second));
  }
}
