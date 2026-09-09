import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class PartnerSyncService {
  constructor(private readonly dataSource: DataSource) {}

  async request(admin: AuthenticatedUser, mitraId: string) {
    if (!admin.isPusat) throw new ForbiddenException('Endpoint ini khusus Pusat');
    const partners = await this.dataSource.query(`SELECT id FROM users WHERE id = $1::uuid AND "isPusat" = FALSE`, [mitraId]);
    if (!partners[0]) throw new NotFoundException('Mitra tidak ditemukan');
    const active = await this.dataSource.query(
      `SELECT id::text, status, requested_at AS "requestedAt" FROM partner_sync_requests
        WHERE mitra_id = $1::uuid AND status IN ('pending', 'processing') ORDER BY requested_at DESC LIMIT 1`, [mitraId],
    );
    if (active[0]) return active[0];
    const rows = await this.dataSource.query(
      `INSERT INTO partner_sync_requests (mitra_id, requested_by)
       VALUES ($1::uuid, $2::uuid)
       RETURNING id::text, status, requested_at AS "requestedAt"`, [mitraId, admin.id],
    );
    return rows[0];
  }

  async status(admin: AuthenticatedUser, requestId: string) {
    if (!admin.isPusat) throw new ForbiddenException('Endpoint ini khusus Pusat');
    const rows = await this.dataSource.query(
      `SELECT id::text, mitra_id::text AS "mitraId", status, requested_at AS "requestedAt",
              started_at AS "startedAt", completed_at AS "completedAt", error_message AS error
         FROM partner_sync_requests WHERE id = $1::uuid`, [requestId],
    );
    if (!rows[0]) throw new NotFoundException('Permintaan sinkronisasi tidak ditemukan');
    return rows[0];
  }

  async claim(user: AuthenticatedUser) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus Mitra');
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id::text FROM partner_sync_requests
          WHERE mitra_id = $1::uuid
            AND (status = 'pending' OR (status = 'processing' AND started_at < now() - interval '5 minutes'))
          ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED`, [user.id],
      );
      if (!rows[0]) return null;
      const updated = await manager.query(
        `UPDATE partner_sync_requests SET status = 'processing', started_at = now(), completed_at = NULL, error_message = NULL
          WHERE id = $1::uuid RETURNING id::text, status, requested_at AS "requestedAt"`, [rows[0].id],
      );
      return updated[0];
    });
  }

  async finish(user: AuthenticatedUser, requestId: string, success: boolean, error?: string) {
    if (user.isPusat) throw new ForbiddenException('Endpoint ini khusus Mitra');
    if (!success && !error?.trim()) throw new BadRequestException('Pesan error wajib diisi');
    const rows = await this.dataSource.query(
      `UPDATE partner_sync_requests
          SET status = $1, completed_at = now(), error_message = $2
        WHERE id = $3::uuid AND mitra_id = $4::uuid AND status = 'processing'
        RETURNING id::text, status, completed_at AS "completedAt"`,
      [success ? 'completed' : 'failed', success ? null : error!.slice(0, 1000), requestId, user.id],
    );
    if (!rows[0]) throw new NotFoundException('Permintaan sinkronisasi aktif tidak ditemukan');
    return rows[0];
  }
}
