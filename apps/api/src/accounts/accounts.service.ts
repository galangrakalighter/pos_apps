import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { OnboardPartnerDto } from './dto/onboard-partner.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AdminUpdatePartnerDto } from './dto/admin-update-partner.dto';

export interface UserProfileRow {
  id: string; username: string; password?: string; partnerName: string; region: string | null; isPusat: boolean; profileImageUrl?: string | null;
}

@Injectable()
export class AccountsService {
  constructor(private readonly dataSource: DataSource) {}

  async onboardPartnerWithStock(admin: AuthenticatedUser, dto: OnboardPartnerDto) {
    if (!admin.isPusat) throw new ForbiddenException('Central admin access required');
    const inputs = dto.items ?? [];
    const seen = new Set<string>();
    for (const item of inputs) {
      if (seen.has(item.warehouseId)) throw new BadRequestException('Barang gudang tidak boleh duplikat');
      seen.add(item.warehouseId);
    }
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        const ids = [...seen].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
        const warehouse: Array<{ id: string; itemName: string; stock: number; centralPrice: string; unit: string }> = await manager.query(
          `SELECT id::text, nama_bumbu AS "itemName", stock::float8 AS stock, harga::text AS "centralPrice", satuan AS unit FROM warehouse
            WHERE id = ANY($1::bigint[]) AND jenis_produk = 'bahan_baku' ORDER BY id FOR UPDATE`, [ids],
        );
        if (warehouse.length !== ids.length) throw new BadRequestException('Barang gudang tidak ditemukan');
        const byId = new Map(inputs.map((item) => [item.warehouseId, item]));
        const normalized = new Map(warehouse.map((item) => {
          const input = byId.get(item.id)!;
          const quantity = this.convertUnit(input.quantity, input.unit, item.unit);
          if (quantity === null) throw new BadRequestException(`Satuan ${input.unit} tidak sesuai untuk ${item.itemName} (${item.unit})`);
          return [item.id, quantity];
        }));
        for (const item of warehouse) {
          if (item.stock < normalized.get(item.id)!) throw new ConflictException(`Stok ${item.itemName} tidak cukup`);
        }

        const users: UserProfileRow[] = await manager.query(
          `INSERT INTO users (username, password, wilayah, nama_mitra, "isPusat")
           VALUES ($1, $2, NULL, $3, FALSE)
           RETURNING id::text, username, nama_mitra AS "partnerName", wilayah AS region, "isPusat" AS "isPusat"`,
          [dto.username, await hash(dto.password, 12), dto.username],
        );
        const partner = users[0];
        if (inputs.length === 0) return { partner, distributionId: null, centralRevenue: '0.00' };
        const totalAmount = warehouse.reduce((sum, item) => sum + Number(item.centralPrice) * normalized.get(item.id)!, 0).toFixed(2);
        const distributions: Array<{ id: string }> = await manager.query(
          `INSERT INTO partner_stock_distributions (pusat_id, mitra_id, total_amount)
           VALUES ($1::uuid, $2::uuid, $3::numeric) RETURNING id::text`,
          [admin.id, partner.id, totalAmount],
        );
        for (const warehouseItem of warehouse) {
          const input = byId.get(warehouseItem.id)!;
          const normalizedQuantity = normalized.get(warehouseItem.id)!;
          // Baris gudang sudah dikunci oleh SELECT ... FOR UPDATE dan stoknya telah
          // divalidasi di atas. Karena itu update ini aman dari concurrent order.
          // Jangan mengandalkan panjang hasil UPDATE ... RETURNING: bentuk hasil raw
          // query TypeORM berbeda antar versi/driver dan pernah memicu false conflict.
          await manager.query(
            `UPDATE warehouse SET stock = stock - $1, updated_at = now()
              WHERE id = $2::bigint`, [normalizedQuantity, warehouseItem.id],
          );
          const products: Array<{ id: string }> = await manager.query(
            `INSERT INTO produk_mitra (mitra_id, master_produk_id, nama_produk, jenis_produk, kategori, stock, harga)
             VALUES ($1::uuid, $5::bigint, $2, 'bahan_baku', 'Bahan baku', $3, $4::numeric) RETURNING id::text`,
            [partner.id, warehouseItem.itemName, normalizedQuantity, '0.00', warehouseItem.id],
          );
          const lineTotal = (Number(warehouseItem.centralPrice) * normalizedQuantity).toFixed(2);
          await manager.query(
            `INSERT INTO partner_stock_distribution_items
              (distribution_id, warehouse_id, partner_product_id, item_name, quantity,
               central_unit_price, partner_retail_price, line_total)
             VALUES ($1::bigint, $2::bigint, $3::bigint, $4, $5, $6::numeric, $7::numeric, $8::numeric)`,
            [distributions[0].id, warehouseItem.id, products[0].id, warehouseItem.itemName,
              normalizedQuantity, warehouseItem.centralPrice, '0.00', lineTotal],
          );
        }
        return { partner, distributionId: distributions[0].id, centralRevenue: totalAmount };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Username sudah digunakan');
      throw error;
    }
  }

  async getOwnProfile(user: AuthenticatedUser) {
    const rows: UserProfileRow[] = await this.dataSource.query(
      `SELECT id::text, username, COALESCE(NULLIF(nama_mitra, ''), username) AS "partnerName", wilayah AS region, "isPusat" AS "isPusat", profile_image_url AS "profileImageUrl"
         FROM users WHERE id = $1::uuid`, [user.id],
    );
    return rows[0];
  }

  async adminUpdatePartner(admin: AuthenticatedUser, partnerId: string, dto: AdminUpdatePartnerDto) {
    if (!admin.isPusat) throw new ForbiddenException('Central admin access required');
    if (dto.username === undefined && dto.password === undefined) throw new BadRequestException('Tidak ada perubahan yang dikirim');
    const partners: UserProfileRow[] = await this.dataSource.query(
      `SELECT id::text, username, password, nama_mitra AS "partnerName", wilayah AS region, "isPusat" AS "isPusat"
         FROM users WHERE id = $1::uuid AND "isPusat" = FALSE`, [partnerId],
    );
    const current = partners[0];
    if (!current) throw new BadRequestException('Akun Mitra tidak ditemukan');
    try {
      const rows: UserProfileRow[] = await this.dataSource.query(
        `UPDATE users SET username = $1, password = $2 WHERE id = $3::uuid
         RETURNING id::text, username, nama_mitra AS "partnerName", wilayah AS region, "isPusat" AS "isPusat"`,
        [dto.username?.trim() ?? current.username, dto.password ? await hash(dto.password, 12) : current.password, partnerId],
      );
      return rows[0];
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Username sudah digunakan');
      throw error;
    }
  }

  async adminDeletePartner(admin: AuthenticatedUser, partnerId: string) {
    if (!admin.isPusat) throw new ForbiddenException('Central admin access required');
    return this.dataSource.transaction(async (manager) => {
        const partners: Array<{ id: string; isLocked: boolean }> = await manager.query(
          `SELECT id::text, is_locked AS "isLocked" FROM users
            WHERE id = $1::uuid AND "isPusat" = FALSE FOR UPDATE`, [partnerId],
        );
        const partner = partners[0];
        if (!partner) throw new BadRequestException('Akun Mitra tidak ditemukan');
        const dependencies: Array<{ used: boolean }> = await manager.query(
          `SELECT (
             EXISTS (SELECT 1 FROM history WHERE mitra_id = $1::uuid) OR
             EXISTS (SELECT 1 FROM orders WHERE pemesan_id = $1::uuid OR pemberi_id = $1::uuid) OR
             EXISTS (SELECT 1 FROM partner_stock_distributions WHERE mitra_id = $1::uuid OR pusat_id = $1::uuid)
           ) AS used`, [partnerId],
        );
        if (dependencies[0]?.used && !partner.isLocked) {
          throw new ConflictException('Akun memiliki transaksi. Ubah status menjadi Locked sebelum menghapus seluruh datanya.');
        }
        if (partner.isLocked) {
          await manager.query(`DELETE FROM history WHERE mitra_id = $1::uuid`, [partnerId]);
          await manager.query(`DELETE FROM orders WHERE pemesan_id = $1::uuid OR pemberi_id = $1::uuid`, [partnerId]);
          await manager.query(`DELETE FROM partner_stock_distributions WHERE mitra_id = $1::uuid OR pusat_id = $1::uuid`, [partnerId]);
        }
        await manager.query(`DELETE FROM produk_mitra WHERE mitra_id = $1::uuid`, [partnerId]);
        await manager.query(`DELETE FROM users WHERE id = $1::uuid`, [partnerId]);
        return { deleted: true, id: partnerId, forced: partner.isLocked };
      });
  }

  async adminSetPartnerLock(admin: AuthenticatedUser, partnerId: string, locked: boolean) {
    if (!admin.isPusat) throw new ForbiddenException('Central admin access required');
    const rows: Array<{ id: string; isLocked: boolean }> = await this.dataSource.query(
      `UPDATE users SET is_locked = $1
        WHERE id = $2::uuid AND "isPusat" = FALSE
        RETURNING id::text, is_locked AS "isLocked"`,
      [locked, partnerId],
    );
    if (!rows[0]) throw new BadRequestException('Akun Mitra tidak ditemukan');
    return rows[0];
  }

  async updateOwnProfile(user: AuthenticatedUser, dto: UpdateOwnProfileDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Tidak ada perubahan yang dikirim');
    }
    return this.dataSource.transaction(async (manager) => {
      const rows: UserProfileRow[] = await manager.query(
        `SELECT id::text, username, password, nama_mitra AS "partnerName", wilayah AS region, "isPusat" AS "isPusat"
           FROM users WHERE id = $1::uuid FOR UPDATE`, [user.id],
      );
      const current = rows[0];
      if (!current) throw new UnauthorizedException('User tidak ditemukan');
      let passwordHash = current.password!;
      if (dto.newPassword) {
        const valid = passwordHash.startsWith('$2')
          ? await compare(dto.currentPassword!, passwordHash)
          : dto.currentPassword === passwordHash;
        if (!valid) throw new UnauthorizedException('Password saat ini salah');
        passwordHash = await hash(dto.newPassword, 12);
      }
      try {
        const updated: UserProfileRow[] = await manager.query(
          `UPDATE users SET username = $1, nama_mitra = $2, wilayah = $3, password = $4
            WHERE id = $5::uuid
            RETURNING id::text, username, COALESCE(NULLIF(nama_mitra, ''), username) AS "partnerName", wilayah AS region, "isPusat" AS "isPusat", profile_image_url AS "profileImageUrl"`,
          [dto.username ?? current.username, dto.partnerName ?? current.partnerName, dto.region ?? current.region, passwordHash, user.id],
        );
        return updated[0];
      } catch (error) {
        if (this.isUniqueViolation(error)) throw new ConflictException('Username sudah digunakan');
        throw error;
      }
    });
  }

  async saveProfileImage(user: AuthenticatedUser, file?: { buffer: Buffer; mimetype: string; originalname: string }) {
    if (!file) throw new BadRequestException('Pilih gambar profil terlebih dahulu');
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Format foto harus JPG, PNG, atau WebP');
    const filename = `${user.id}-${randomUUID()}.${extension}`;
    const directory = join(process.cwd(), 'uploads', 'profiles');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer);
    const imageUrl = `/api/v1/profile/images/${filename}`;
    const result = await this.dataSource.query(
      `UPDATE users SET profile_image_url = $1 WHERE id = $2::uuid
       RETURNING id::text, username, COALESCE(NULLIF(nama_mitra, ''), username) AS "partnerName",
                 wilayah AS region, "isPusat" AS "isPusat", profile_image_url AS "profileImageUrl"`,
      [imageUrl, user.id],
    );
    // Beberapa versi kombinasi TypeORM/pg mengembalikan [rows, rowCount]
    // untuk query UPDATE ... RETURNING. Endpoint harus selalu mengirim satu
    // object profil agar klien tidak membaca response yang sebenarnya sukses
    // sebagai response tidak valid.
    const profile = this.resultRows<UserProfileRow>(result)[0];
    if (!profile) throw new UnauthorizedException('User tidak ditemukan');
    return profile;
  }

  async profileImage(filename: string) {
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) throw new NotFoundException('Foto profil tidak ditemukan');
    try {
      const data = await readFile(join(process.cwd(), 'uploads', 'profiles', filename));
      const type = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return new StreamableFile(data, { type });
    } catch { throw new NotFoundException('Foto profil tidak ditemukan'); }
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }

  private resultRows<T>(result: unknown): T[] {
    if (!Array.isArray(result)) return [];
    if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as T[];
    return result as T[];
  }

  private convertUnit(quantity: number, from: string, to: string): number | null {
    if (from === to) return quantity;
    if (from === 'kilogram' && to === 'gram') return quantity * 1000;
    if (from === 'gram' && to === 'kilogram') return quantity / 1000;
    if (from === 'liter' && to === 'mililiter') return quantity * 1000;
    if (from === 'mililiter' && to === 'liter') return quantity / 1000;
    return null;
  }
}
