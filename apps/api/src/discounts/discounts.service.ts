import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { SaveDiscountDto } from './discounts.dto';

@Injectable()
export class DiscountsService {
  constructor(private readonly dataSource: DataSource) {}

  list(user: AuthenticatedUser) {
    return this.dataSource.query(
      `SELECT id::text, name, type, value::float8 AS value, is_active AS "isActive"
         FROM discounts
        WHERE deleted_at IS NULL AND ($1::boolean = TRUE OR is_active = TRUE)
        ORDER BY name, id`, [user.isPusat],
    );
  }

  async create(user: AuthenticatedUser, dto: SaveDiscountDto) {
    this.admin(user); this.validate(dto);
    try {
      const rows = await this.dataSource.query(
        `INSERT INTO discounts (name, type, value, is_active) VALUES ($1, $2, $3, $4)
         RETURNING id::text, name, type, value::float8 AS value, is_active AS "isActive"`,
        [dto.name.trim(), dto.type, dto.value, dto.isActive ?? true],
      );
      return rows[0];
    } catch (error) { this.unique(error); throw error; }
  }

  async update(user: AuthenticatedUser, id: string, dto: SaveDiscountDto) {
    this.admin(user); this.validate(dto);
    try {
      const rows = await this.dataSource.query(
        `UPDATE discounts SET name=$1, type=$2, value=$3, is_active=$4, updated_at=now()
          WHERE id=$5::bigint AND deleted_at IS NULL
          RETURNING id::text, name, type, value::float8 AS value, is_active AS "isActive"`,
        [dto.name.trim(), dto.type, dto.value, dto.isActive ?? true, id],
      );
      if (!rows[0]) throw new NotFoundException('Diskon tidak ditemukan');
      return rows[0];
    } catch (error) { this.unique(error); throw error; }
  }

  async remove(user: AuthenticatedUser, id: string) {
    this.admin(user);
    const rows = await this.dataSource.query(
      `UPDATE discounts SET deleted_at=now(), is_active=FALSE, updated_at=now()
        WHERE id=$1::bigint AND deleted_at IS NULL RETURNING id::text`, [id],
    );
    if (!rows[0]) throw new NotFoundException('Diskon tidak ditemukan');
    return { deleted: true, id: rows[0].id };
  }

  private admin(user: AuthenticatedUser) { if (!user.isPusat) throw new ForbiddenException('Khusus akun Pusat'); }
  private validate(dto: SaveDiscountDto) {
    if (!dto.name.trim()) throw new BadRequestException('Nama diskon wajib diisi');
    if (dto.type === 'percent' && dto.value > 100) throw new BadRequestException('Diskon persen maksimal 100%');
  }
  private unique(error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505') throw new ConflictException('Nama diskon sudah digunakan');
  }
}
